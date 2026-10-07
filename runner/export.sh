#!/usr/bin/env bash
# Publish one run to the website: shots + previews → frontend/public/bench/<bench>/<task>/<model>.{png,mp4},
# and a results entry printed as JSON for src/data/bench.ts (paste or pipe into bench-results.json).
#   ./export.sh runs/<bench>_<task>/<ts> [shot=shot.png] [video=preview.mp4]
set -euo pipefail; run=$(readlink -f "$1"); shot=${2:-shot.png}; vid=${3:-preview.mp4}
name=$(basename "$(dirname "$run")"); bench=${name%%_*}; task=${name#*_}
PUB=$(readlink -f "$(dirname "$0")/../../frontend/public/bench")/$bench/$task; mkdir -p "$PUB"
entries=()
for d in "$run"/*/; do d=${d%/}; [ -f "$d/meta.json" ] || continue; slug=$(basename "$d")
  img=""; v=""
  # Live page: same html, importmap repointed from the sandbox's /vendor to the same version on a CDN.
  live=""; [ -s "$d/work/index.html" ] && live="/bench/$bench/$task/$slug.html" && sed -e 's#"/vendor/three@\([0-9.]*\)/three\.module\.min\.js"#"https://unpkg.com/three@\1/build/three.module.min.js"#' -e 's#"/vendor/three@\([0-9.]*\)/addons/"#"https://unpkg.com/three@\1/examples/jsm/"#' "$d/work/index.html" > "$PUB/$slug.html"
  # SVG bench: live view = the animated svg itself (SMIL/CSS), fitted into a tiny html page.
  svg=$(ls "$d"/work/*.svg 2>/dev/null | head -1 || true)
  [ -z "$live" ] && [ -n "$svg" ] && live="/bench/$bench/$task/$slug.html" && cp "$svg" "$PUB/$slug.svg" \
    && printf '<!doctype html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#fff"><img src="%s.svg" style="width:100%%;height:100%%;object-fit:contain"></body>\n' "$slug" > "$PUB/$slug.html"
  [ -s "$d/work/$shot" ] && img="/bench/$bench/$task/$slug.jpg" && ffmpeg -y -loglevel error -i "$d/work/$shot" -vf scale=960:-1 "$PUB/$slug.jpg"
  [ -s "$d/work/$vid" ] && v="/bench/$bench/$task/$slug.mp4" && ffmpeg -y -loglevel error -i "$d/work/$vid" -t 12 -an -vf scale=960:-2 -c:v libx264 -crf 28 -preset slow -movflags +faststart "$PUB/$slug.mp4"
  entries+=("$(jq -c --arg slug "$slug" --arg img "$img" --arg v "$v" --arg live "$live" \
    '{model:(.model|sub("^[^:]+:";"")), slug:$slug, qualified:(.qualified//false), cost:(if .cost_usd == null then null else (.cost_usd*1000|round/1000) end), wall_s:.wall_s, turns:(.turns//null), img:(if $img == "" then null else $img end), video:(if $v == "" then null else $v end), note:(.reason // null), badges:(.badges // []), perf:(.perf // null), live:(if $live == "" then null else $live end), todo:(.todo//null), todoPublic:(.todo_public//false)}' "$d/meta.json")")
done
jq -n --arg bench "$bench" --arg task "$task" --arg date "$(basename "$run" | cut -c1-10)" --arg prompt "$(cat "$run/prompt.txt" | head -1)" \
  --argjson runs "$(printf '%s\n' "${entries[@]}" | jq -s .)" '{bench:$bench, task:$task, date:$date, prompt:$prompt, runs:$runs}'
du -sh "$PUB" >&2
