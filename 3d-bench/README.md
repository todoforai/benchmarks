# 3DBench

One prompt → every model, independent sandboxes, outputs side by side. No Elo: contact sheet +
hand-written ranking per task. Two kinds of task, same runner:

**three.js** (`lava-lamp`, `rocket-launch`, `sunset-ocean`, `turntable`, `black-hole`): one design
sentence → a single-file `index.html` with the pinned `three@0.182.0` from an importmap, 1280×800,
"qualified" = loads with no console errors. Modelled on BridgeBench's Design Bench. Contract tail,
collect script and prompt history: [`threejs/`](threejs/).

**Blender** (`island` match a reference image, `pizza` animated Breaking Bad pizza throw from a
reference gif): headless `blender -b --python`, output `out/render.png` (+ `scene.blend`, mp4 where asked).

```
tasks/<task>/prompt.txt   theme + contract (identical for every model)
tasks/<task>/task.env     TIMEOUT
tasks/<task>/collect.sh   three.js → threejs/collect.sh (qualify + shot.png + 20 s preview.mp4 + perf)
```

```bash
../runner/vendor.sh                       # once: three@0.182.0 → runner/vendor/ (gitignored)
../runner/run.sh 3d-bench/lava-lamp -p 4 "anthropic/claude-opus-5.5(high)" "openai/gpt-6.1-sol(high)"
../runner/sheet.sh ../runner/runs/3d-bench_lava-lamp/<ts>              # sheet.png + RESULTS.md
../runner/sheet.sh ../runner/runs/3d-bench_island/<ts> out/render.png  # Blender
../runner/publish.sh                      # → frontend bench-results.json
```

Every model runs in its own bubblewrap sandbox (`runner/sandbox.sh`): empty `/work`, read-only
`/vendor`, no view of other runs. meta.json per model: wall_s, cost_usd, turns, qualified.
