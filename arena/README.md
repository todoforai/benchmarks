# arena — creative one-shot benchmarks (SVG / web / 3D game / Blender)

Same harness idea as `../pelican` but every run is **sandboxed** with bubblewrap
(`sandbox.sh`, no Docker, no images, ~0 MB/run): host `/usr` `/snap` `/opt` read-only, `/work`
= empty dir + the task's `assets/` is the only writable path, private `/tmp` and
HOME, no `/home`, own PID namespace, env cleared. Models can't see each other's
files, the host user's files, or earlier runs. Key via env (never argv), one key
per concurrent container. Host tools are reused (blender, google-chrome, ffmpeg,
bun, node) — install what a task needs on the host. GPU is passed through
(`/dev/dri`, `/dev/nvidia*`): Cycles OPTIX/CUDA and EEVEE work in the sandbox.
The mayfly bridge runs bash in `$TMPDIR/todoforai`, so that path is bound to `/work` too.

Agent-side isolation is `todoforai-cli --isolated` (bridge `--mayfly <todoId>`):
the todo sees only this one ephemeral bridge — no cloud VM, no other devices.

One-time on Ubuntu 24.04 (unprivileged userns is blocked by AppArmor):
```bash
sudo cp apparmor-bwrap /etc/apparmor.d/bwrap && sudo apparmor_parser -r /etc/apparmor.d/bwrap
./sandbox.sh /tmp -- ls /   # must work without "setting up uid map: Permission denied"
```

```
tasks/<task>/prompt.txt     the one-shot prompt (identical for every model)
tasks/<task>/assets/        copied into /work before the run (reference images…)
tasks/<task>/task.env       TIMEOUT=…  (optional)
tasks/<task>/collect.sh     post-run: rasterize / record output (runs in the sandbox too)
runs/<task>/<ts>/<model>/   work/ (= sandbox /work), agent.log (timestamped stream),
                            timeline/ (every saved version of the outputs, record.sh),
                            timelapse.mp4 (timeline rasterized + labelled), meta.json
```

Tasks: `pelican`, `device-svg`, `web-animated`, `game-3d`, `blender-island`
(reference-image match, from `api-apps/blender-api/demo`), `blender-danger`
(Breaking Bad pizza-throw scene from a reference gif, animated).

```bash
(cd rec && bun install)        # once: playwright-core (uses host google-chrome)
./run.sh pelican               # default models, sequential
./run.sh game-3d -p 3 openai:openai/gpt-6-sol anthropic:anthropic/claude-opus-5
```

Recording — no X/Xvfb, no screen grabbing:
- `record.sh` (inotify) keeps every saved artifact version in `timeline/`;
  `timelapse.sh` → `rec/timelapse.ts` renders them (headless Chrome) into a labelled mp4.
- Web/game outputs: `rec/rec.ts` = Playwright + CDP `Page.startScreencast` → system
  ffmpeg (scripted scroll; games are only watched idle for now, `game` script exists); page errors → `*.errors.txt`.
- `agent.log` has the timestamped tool stream; the todo itself (`todofor.ai/t/<id>` in agent.log, or
`GET /api/v1/todos/<id>/messages`) is the full replay for a Remotion cut later.

Agent config is the Terminal-Bench one (`--isolated --agent app`, xhigh, bash+read+webfetch).
Blender tasks are **headless** (`blender -b --python`) — not the `blender-mcp`
route the product uses; that needs one GUI Blender and can't be isolated per model. Judging is subjective ranking like pelican; write `RESULTS_<task>.md`.
