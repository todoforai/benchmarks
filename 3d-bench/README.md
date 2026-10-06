# 3DBench

Blender, headless (`blender -b --python`), one prompt → every model, independent sandboxes.
Output per model: `out/render.png` (+ `scene.blend`, animation mp4 where asked). Ranking by
side-by-side renders (`../runner/sheet.sh <run> out/render.png`), no Elo.

Tasks: `island` (match a reference image), `pizza` (animated Breaking Bad pizza throw from a reference gif).

```bash
../runner/run.sh 3d-bench/island -p 2 anthropic/claude-opus-5.5 openai/gpt-6.1-sol
```
