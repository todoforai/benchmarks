# svg-pizza — 2026-09-23 (run 14-43-16)

Same prompt, one shot, own bwrap sandbox each, `read` enabled (models see the reference frames).
Timeout 40 min. Cost = what TODO for AI billed (runMeta.cost, promo prices).

| Model | Result | Wall | Cost | Turns | pizza.svg |
|---|---|---|---|---|---|
| GPT-6 Sol | ✅ done | 401 s | $0.016 | 12 | 17.1k chars |
| GPT-5.6 Sol | ✅ done | 478 s | $0.105 | 6 | 18.5k chars |
| Opus 5.5 | ⏱ timeout (SVG saved at 25 min, kept refining) | 2400 s | $0.593 | 45 | 20.2k chars |
| Opus 5 | ⏱ timeout (SVG saved at 35 min, kept refining) | 2400 s | $0.752 | 73 | 16.6k chars |

`grid.png` = reference + first frames (Sol 6, Sol 5.6 / Opus 5.5, Opus 5), `grid.mp4` = 4 s animations.
Earlier runs (12-19, 12-52) are invalid: sandbox had no `read` tool (old bridge + app agent perms).
