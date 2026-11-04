#!/usr/bin/env bash
# Publish one run to the website: shots + previews → frontend/public/bench/<bench>/<task>/<model>.{png,mp4},
# and a results entry printed as JSON for src/data/bench.ts (paste or pipe into bench-results.json).
#   ./export.sh runs/<bench>_<task>/<ts> [shot=shot.png] [video=preview.mp4]
set -euo pipefail; run=$(readlink -f "$1"); shot=${2:-shot.png}; vid=${3:-preview.mp4}
name=$(basename "$(dirname "$run")"); bench=${name%%_*}; task=${name#*_}
PUB=$(readlink -f "$(dirname "$0")/../../frontend/public/bench")/$bench/$task; mkdir -p "$PUB"
entries=()
# Task assets the prompt hands the model at /work/... (e.g. ref/doge.png): ship them next to the live pages,
# whose absolute /work/ paths are rewritten to relative below.
TD=$(dirname "$0")/../$bench/tasks/$task/assets; [ -d "$TD" ] && cp -r "$TD"/. "$PUB"/
# SPIN=<s> in task.env: inject rec/spin.html (slow turntable) into each live page, re-record shot + preview from it.
SPIN=$(TE=$(dirname "$0")/../$bench/tasks/$task/task.env; [ -f "$TE" ] && . "$TE"; echo "${SPIN:-}")
REC=$(readlink -f "$(dirname "$0")/rec")
for d in "$run"/*/; do d=${d%/}; [ -f "$d/meta.json" ] || continue; slug=$(basename "$d")
  img=""; v=""
  # Live page: same html, importmap repointed from the sandbox's /vendor to the same version on a CDN.
  live=""; [ -s "$d/work/index.html" ] && live="/bench/$bench/$task/$slug.html" && sed -e 's#"/vendor/three@\([0-9.]*\)/three\.module\.min\.js"#"https://unpkg.com/three@\1/build/three.module.min.js"#' -e 's#"/vendor/three@\([0-9.]*\)/addons/"#"https://unpkg.com/three@\1/examples/jsm/"#' -e 's#\([\x27"`(]\)/work/#\1#g' "$d/work/index.html" > "$PUB/$slug.html"
  if [ -n "$SPIN" ] && [ -n "$live" ]; then
    SPINJS=$(sed "s/__SPIN__/$SPIN/" "$REC/spin.html") perl -0pi -e 's#(<script type="importmap">.*?</script>)#$1$ENV{SPINJS}#s' "$PUB/$slug.html"
    tmp=$(mktemp -d); (cd "$REC" && bun rec.ts "/$slug.html" "$tmp/preview.mp4" --serve "$PUB" --w 1280 --h 800 --secs 14 --script idle --shot "$tmp/shot.png" >/dev/null 2>&1) || true
  fi
  # SVG bench: live view = the animated svg itself (SMIL/CSS), fitted into a tiny html page.
  svg=$(ls "$d"/work/*.svg 2>/dev/null | head -1 || true)
  [ -z "$live" ] && [ -n "$svg" ] && live="/bench/$bench/$task/$slug.html" && cp "$svg" "$PUB/$slug.svg" \
    && printf '<!doctype html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#fff"><img src="%s.svg" style="width:100%%;height:100%%;object-fit:contain"></body>\n' "$slug" > "$PUB/$slug.html"
  src=$d/work; [ -n "$SPIN" ] && [ -s "${tmp:-}/preview.mp4" ] && src=$tmp
  [ -s "$src/$shot" ] && img="/bench/$bench/$task/$slug.jpg" && ffmpeg -y -loglevel error -i "$src/$shot" -vf scale=960:-1 "$PUB/$slug.jpg"
  [ -s "$src/$vid" ] && v="/bench/$bench/$task/$slug.mp4" && ffmpeg -y -loglevel error -i "$src/$vid" -t 12 -an -vf scale=960:-2 -c:v libx264 -crf 28 -preset slow -movflags +faststart "$PUB/$slug.mp4"
  entries+=("$(jq -c --arg slug "$slug" --arg img "$img" --arg v "$v" --arg live "$live" \
    '{model:(.model|sub("^[^:]+:";"")), slug:$slug, qualified:(.qualified//false), cost:(if .cost_usd == null then null else (.cost_usd*1000|round/1000) end), wall_s:.wall_s, turns:(.turns//null), img:(if $img == "" then null else $img end), video:(if $v == "" then null else $v end), note:(.reason // null), badges:(.badges // []), perf:(.perf // null), live:(if $live == "" then null else $live end), todo:(.todo//null), todoPublic:(.todo_public//false)}' "$d/meta.json")")
done
# KIND=spec in task.env = long multi-paragraph spec: publish the whole prompt (minus the "Output:" contract tail), not just line 1.
KIND=$(TE=$(dirname "$0")/../$bench/tasks/$task/task.env; [ -f "$TE" ] && . "$TE"; echo "${KIND:-}")
if [ "$KIND" = spec ]; then prompt=$(sed '/^Output:/,$d' "$run/prompt.txt"); else prompt=$(head -1 "$run/prompt.txt"); fi
jq -n --arg bench "$bench" --arg task "$task" --arg date "$(basename "$run" | cut -c1-10)" --arg prompt "$prompt" --arg kind "$KIND" \
  --argjson runs "$(printf '%s\n' "${entries[@]}" | jq -s .)" '{bench:$bench, task:$task, date:$date, prompt:$prompt, runs:$runs} + (if $kind == "" then {} else {kind:$kind} end)'
du -sh "$PUB" >&2
