# MILKCROWN

> **"Drop milk into milk. Make a crown."**

A one-prompt physics benchmark. The model writes a single file, `milk.js`, that
simulates a milk drop hitting a shallow pool. The splash is axisymmetric, so the
model works in the (r, z) half-plane and hands back the free surface; the harness
revolves it, measures the solid of revolution, and prints a number. No LLM judge,
no taste, and the model never draws a pixel.

Everyone has seen [Edgerton's photograph](https://en.wikipedia.org/wiki/Harold_Eugene_Edgerton).
Nobody can compute it.

## Why this one

| | |
|---|---|
| one sentence | nine words, no context needed |
| pass/fail by eye | the viewer already knows what a crown looks like |
| not memorizable | free surface + surface tension + Plateau-Rayleigh breakup, together. No copyable repo. |
| scored, not judged | crown, fingers, droplets, spreading, all gated on the response to the parameters |
| cannot be drawn | the submission returns geometry, not pixels; there is nothing to paint |
| the failures are funny | mushroom, spray, or a puddle that never moves |

## Run it

```bash
npm i playwright            # headless driver; uses your system Chrome
node score.js               # all entries, seeds 1..5
node score.js reference     # one entry
SEEDS=1,2,3 node score.js   # fewer seeds
./run.sh                    # dispatch models through the agent, then score
open results/view.html      # side-by-side player, all lanes on one clock
node video.js               # mp4 of every lane        -> results/milkcrown.mp4
node video.js reference     # mp4 of one entry         -> results/reference.mp4
SEED=3 SECONDS=20 node video.js
```

`video.js` needs ffmpeg. It replays all 201 simulation frames (the impact is
10 ms of real time) stretched over `SECONDS`, holds the last frame for 2 s, and
sorts the lanes best-first. The camera looks down on the revolved surface at an
oblique angle, which is the Edgerton view.

The 2D pixel-scored version this replaced is kept in `v1/`.

## Files

```
prompt.txt            the task, verbatim, as handed to the model
harness.html          owns the canvas and the clock, measures the pixels
score.js              runs every entry over every seed -> results/
entries/<name>.js     one submission per model
entries/reference.js  proof the benchmark is reachable, pins the top of the scale
entries/fail-*.js     the failure modes, they anchor the low end
entries/cheat-*.js    negative controls: a drawing and a canned animation
results/view.html     the demo: every lane playing the same impact
video.js              renders results/*.mp4 from the same frames
```

## Adding a model

```bash
cp their-milk.js entries/gpt-5.6-sol.js
node score.js && node video.js
```

That is the whole loop. An entry is one self-contained file that sets
`window.BENCH`; the file name becomes the lane name. `./run.sh` automates the
dispatch: it runs the prompt through the agent per model and copies each
`milk.js` into `entries/<model-slug>.js`.

## Adding another benchmark

The three pieces are independent and none of them know about milk:

- `harness.html` — owns the clock, calls `reset/step/state`, measures the
  geometry, renders it, exposes `RUN` / `PROBE` / `FILM`
- `score.js` — drives entries over seeds, writes `results/scores.json`
- `video.js` — reads `FILM` frames, composes the grid, calls ffmpeg

A new one is a sibling directory with its own `prompt.txt`, its own metrics in
`harness.html`, and the same `score.js` / `video.js` copied over. Keep the three
rules — volume conservation, change-not-picture, and a parameter probe — and the
new benchmark will resist the same cheats.

## The contract

The model defines one global:

```js
window.BENCH = { reset(p), step(dt), state() }
```

`state()` returns `{ profile: [[r, z], ...], fingers, drops }` in SI units: the
free surface as a path from the axis out to `p.domainR_m`, the number of fingers
around the rim, and rings of `n` droplets in flight. The harness closes the path
with the wall and the floor and revolves it. `step` gets a fixed `dt = 5e-5 s`
and must be deterministic. Two helpers, `REVOLVE(profile, p)` and
`LEVEL(profile, p, drops)`, make volume conservation bookkeeping rather than a
trap.

## Score

```
0.40  crown       an annular wall stands while the middle stays hollow, then falls back
0.30  fingers     the declared finger count against N ~ We^0.5
0.15  droplets    rings of droplets shed after impact, not present at t=0
0.15  spreading   rim radius correlates with sqrt(t)
 x    response    a MULTIPLIER, 0..1, see below
```

Three rules do the real work:

- **Volume.** Exact, not rasterized: the profile is revolved as a solid and the
  droplets are added as spheres. Drift beyond **10% of the drop** invalidates the
  run — and the pool is about a hundred drops, so that is a tight gate.
  `fail-explode` sits at 1755%.
- **Change, not picture.** A crown already standing on frame 0 scores 0 for
  crown. Droplets only count if they appear *after* impact.
- **Response, as a multiplier.** The same code is replayed with one parameter
  changed at a time, and five trends are checked:

  | axis | what it changes | what must happen |
  |---|---|---|
  | higher | impact speed 0.55x vs 1.7x | higher crown, more fingers |
  | sooner | impact speed 0.55x vs 1.7x | the crown peaks **earlier** — the splash clock is D/V |
  | tension | surface tension 2.5x | **fewer** fingers, the rim beads coarser |
  | viscous | viscosity 12x | **lower** crown, the boundary layer eats the sheet |
  | deeper | pool depth 4x | **lower** crown, a deep pool swallows the impact |

  The average of the five multiplies everything else. This is the whole
  benchmark: a shape that does not react to the physics is worth zero however
  well it is drawn.

## Calibration

| entry | score | what it is |
|---|---|---|
| reference | 0.895 | analytic crater + rim, earns all five response axes |
| cheat-fitted | 0.556 | a canned shape with three of the five trends hardcoded |
| cheat-scaled | 0.187 | a canned shape scaled by the impact speed |
| cheat-scripted | 0.000 | a canned animation on a fixed clock |
| cheat-static | 0.000 | a frozen crown |
| fail-blob | 0.000 | the drop just sinks in, no crown |
| fail-spray | 0.000 | droplets everywhere, no wall |
| fail-flat | 0.000 | nothing happens |
| fail-explode | 0.000 | unbounded growth, 1755% volume drift |

`cheat-fitted` is the honest ceiling on cheating: it is a drawing that has had
the answers written into it by hand — the D/V clock and the sigma dependence of
the finger count — and it still loses a third of the score because it ignores
viscosity and pool depth. Every axis you add costs the faker another hardcoded
law, and at some point writing them all down *is* the physics.

`reference.js` is not a fluid solver — it is an analytic model, there to prove
the target is reachable. A real submission is expected to actually simulate, and
should beat it.

## Known limits

- Entries run in the same JS realm as the scorer, so a hostile submission could
  overwrite `RUN`. Fine for model outputs, not for adversarial ones.
- **`fingers` is declared, not measured.** The model states a number and the
  harness checks it against `N ~ We^0.5`; it cannot see whether the submission
  actually resolved the Plateau-Rayleigh instability. The renderer draws the
  declared count, so the picture and the score always agree, but an entry can
  report the right number for the wrong reason.
- The probe checks the *sign* of five dependences, not their exponents. It
  separates simulation from animation and makes faking expensive; it does not
  prove the scaling laws are right. `cheat-fitted` at 0.556 is the measure of
  exactly how far that gets you.
- Axisymmetry is imposed, not discovered. A real crown breaks symmetry once the
  fingers grow; here the fingers are a number, not a shape.
