# Pelican-on-a-bicycle (Simon Willison's benchmark) — 2026-09-07

Harness = the Terminal-Bench 82% config: `todoforai-cli --isolated --agent app`
(narrow tool set, xhigh thinking), strict prompt, one attempt per model, SVG written
by hand by the agent. Rasterized headless Chrome (`render.sh`).

| Model | Wall | bash calls | SVG | Notes |
|---|---|---|---|---|
| gpt-5.6-sol (xhigh) | ~6 min | 1 | 12.9 KB, 1200×850 | Breeding plumage (yellow crown, chestnut hindneck), big red pouch, feather texture, feet on pedals + rotation arrows, full diamond frame with spokes |
| claude-opus-5 (xhigh) | ~5 min | 1 | 11.5 KB, 800×600 | Cleanest picture; red pouch, scalloped feathers, chain + chainring; body floats above the frame (no saddle contact). 1st attempt died on a provider stream stall, rerun fine |
| claude-sonnet-5 (xhigh) | ~16 min | 7 | 18.4 KB, 800×600 | Precomputed spokes/ticks into files, assembled in Python; weakest result: pouch reads as a hook, bird stretched flat over the frame, legs ambiguous |

![comparison](results/comparison.png)

Per-model: `results/<model>.svg` / `.png`, side-by-side `results/comparison.html`.

Subjective rank: **Opus 5 ≈ Sol > Sonnet 5**. Opus is the prettier picture, Sol the more
anatomically literal one (pouch shape, plumage, pedaling actually indicated). Sonnet spent
7 tool calls and 3× the time on a worse drawing.

Gotchas
- Opus 5 first run failed at the provider ("stream stalled repeatedly"), not our infra.
- Editing `run.sh` while a run is live → the running bash reads garbage (`error reading
  input file`). Same rule as LESSONS.md: never edit a running script.
- No `rsvg-convert` on either box; `render.sh` uses headless Chrome and takes the size from
  the SVG's own viewBox (a fixed window silently crops, e.g. Sol's 1200×850).
- SVGs are recoverable from the todo messages via `GET /api/v1/todos/<id>/messages` if the
  machine that ran them is offline.
