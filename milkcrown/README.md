# MILKCROWN

> **"Drop milk into milk. Make a crown."**

A one-prompt physics benchmark. The model writes a single file, `milk.js`, that
simulates a milk drop hitting a shallow pool. The harness runs it, measures the
pixels, and prints a number. No LLM judge, no taste.

Everyone has seen [Edgerton's photograph](https://en.wikipedia.org/wiki/Harold_Eugene_Edgerton).
Nobody can compute it.

## Why this one

| | |
|---|---|
| one sentence | nine words, no context needed |
| pass/fail by eye | the viewer already knows what a crown looks like |
| not memorizable | free surface + surface tension + Plateau-Rayleigh breakup, together. No copyable repo. |
| scored, not judged | crown, symmetry, response, droplets, spreading |
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
sorts the lanes best-first. Default output is 18 s, ~250 KB.

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

- `harness.html` — owns the canvas and the clock, calls `reset/step/draw`,
  measures pixels, exposes `RUN` / `PROBE` / `FILM`
- `score.js` — drives entries over seeds, writes `results/scores.json`
- `video.js` — reads `FILM` frames, composes the grid, calls ffmpeg

A new one is a sibling directory with its own `prompt.txt`, its own metrics in
`harness.html`, and the same `score.js` / `video.js` copied over. Keep the three
rules — volume conservation, change-not-picture, and a parameter probe — and the
new benchmark will resist the same cheats.

## The contract

The model defines one global:

```js
window.BENCH = { reset(p), step(dt), draw(ctx) }
```

`draw` may only paint liquid. Transparent means "not liquid" — the harness reads
the alpha channel and nothing else, so a background, a sky or a light source is
scored as milk. `step` gets a fixed `dt = 5e-5 s` and must be deterministic.

## Score

```
0.35  crown       sheets standing on both sides at wall height, none over the impact
0.20  symmetry    mirror agreement above the undisturbed surface
0.20  response    replay at 0.55x and 1.7x impact speed - does the crown get taller?
0.15  droplets    blobs that detach from the pool-connected liquid after impact
0.10  spreading   rim radius correlates with sqrt(t)
```

Three rules do the real work:

- **Volume.** A run whose active liquid area drifts more than 15% is **invalid**
  and scores 0. Only liquid above the pool floor counts, so a big background
  rectangle cannot hide a volume error. This kills every unstable solver —
  `fail-explode` draws a convincing arch and still scores zero at 392% drift.
- **Change, not picture.** A crown that is already standing on frame 0 scores 0
  for crown. Droplets only count if they appear *after* impact. A still image
  earns nothing.
- **Response.** The same entry is run again at 0.55x and 1.7x the impact speed.
  Real physics throws a higher crown when hit harder; a hardcoded animation
  replays the identical frames and takes a zero. This is the anti-cheat.

Everything above the surface is judged on the liquid **connected to the pool**,
so one stray dot cannot define the rim.

## Calibration

| entry | score | what it is |
|---|---|---|
| reference | 0.922 | analytic crater + rim, responds to Weber number |
| cheat-scripted | 0.432 | walls animated outward as sqrt(t), ignores every parameter |
| fail-spray | 0.272 | the drop shatters into particles |
| cheat-static | 0.200 | a frozen picture of a crown |
| fail-flat | 0.145 | ripples only, nothing breaks the surface |
| fail-blob | 0.000 | mushroom over the impact point, 37% volume drift |
| fail-explode | 0.000 | unstable solver, 392% volume drift |

The gap that matters is **0.922 vs 0.432**: the best possible fake, a smooth
canned animation that looks plausible in the viewer, cannot get past half. Both
cheats score exactly 0.00 on response.

`reference.js` is not a fluid solver — it is an analytic model, there to prove
the target is reachable. A real submission is expected to actually simulate, and
should beat it.

## Known limits

- Entries run in the same JS realm as the scorer, so a hostile submission could
  overwrite `RUN`. Fine for model outputs, not for adversarial ones.
- Rasterized area is a proxy for volume: thin sheets and overlapping droplets
  lose pixels. The 15% band is calibrated against the reference, not proven for
  every solver.
- `response` checks the *sign* of the dependence on impact speed, not its
  exponent. It separates simulation from animation; it does not verify that the
  scaling law is right.
