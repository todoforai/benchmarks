# VideoBench

The *Painted Launch Video* registry template (`todo-registry/TODO-templates/painted-launch-vid-agent.md`,
private sysprompt) run on a fixed input project, model varied. Output: `out/<company>.mp4` + social cuts.
Needs `suno-api` + `ffmpeg` in the sandbox (Suno key via env). ~$2–5 per model per run.

Tasks (`tasks/<name>/prompt.txt` = the template's user task with the project filled in; `assets/` = project snapshot):
_TODO_

Agent: `painted-launch` (template sysprompt) instead of the default `arena` agent → `AGENT=painted-launch ../runner/run.sh video-bench/<task> …`.
Ranking: thumbnails sheet + watching, written by hand.
