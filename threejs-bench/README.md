# ThreeJSBench

Same design prompt → every model, one single-file three.js page each, side by side. No Elo, no
votes: a contact sheet + a hand-written ranking per task (`RESULTS_<task>.md`). Modelled on
BridgeBench's Design Bench (same 5 themes, same pinned `three@0.182.0` from an importmap,
1280x800, "qualified" = loads with no console errors).

```
tasks/<task>/prompt.txt   theme sentence + CONTRACT.md tail (identical for every model)
tasks/<task>/task.env     TIMEOUT
collect.sh                qualify + shot.png + 20 s preview.mp4 (headless Chrome, SwiftShader)
```

Tasks: `lava-lamp`, `rocket-launch`, `sunset-ocean`, `turntable`, `black-hole`.

```bash
../runner/vendor.sh                       # once: three@0.182.0 → runner/vendor/ (gitignored)
../runner/run.sh threejs-bench/lava-lamp -p 4 anthropic/claude-opus-5.5 anthropic/claude-sonnet-5.5 openai/gpt-6.1-sol deepseek/deepseek-v4.1-flash
../runner/sheet.sh ../runner/runs/threejs-bench_lava-lamp/<ts>    # sheet.png + RESULTS.md table (fill the rank column)
```

Every model runs in its own bubblewrap sandbox (`runner/sandbox.sh`): empty `/work`, read-only
`/vendor`, no view of other runs. meta.json per model: wall_s, cost_usd, turns, qualified.
