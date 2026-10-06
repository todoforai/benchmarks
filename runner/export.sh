#!/usr/bin/env bash
# Publish one run to the website: shots + previews → frontend/public/bench/<bench>/<task>/<model>.{png,mp4},
# and a results entry printed as JSON for src/data/bench.ts (paste or pipe into bench-results.json).
#   ./export.sh runs/<bench>_<task>/<ts> [shot=shot.png] [video=preview.mp4]
set -euo pipefail; run=$(readlink -f "$1"); shot=${2:-shot.png}; vid=${3:-preview.mp4}
name=$(basename "$(dirname "$run")"); bench=${name%%_*}; task=${name#*_}
PUB=$(readlink -f "$(dirname "$0")/../../frontend/public/bench")/$bench/$task; mkdir -p "$PUB"
entries=()
for d in "$run"/*/; do d=${d%/}; [ -f "$d/meta.json" ] || continue; slug=$(basename "$d")
  [ -s "$d/work/$shot" ] && ffmpeg -y -loglevel error -i "$d/work/$shot" -vf scale=960:-1 "$PUB/$slug.jpg"
  [ -s "$d/work/$vid" ] && ffmpeg -y -loglevel error -i "$d/work/$vid" -t 12 -an -vf scale=960:-2 -c:v libx264 -crf 28 -preset slow -movflags +faststart "$PUB/$slug.mp4"
  entries+=("$(jq -c --arg slug "$slug" --arg img "/bench/$bench/$task/$slug.jpg" --arg v "/bench/$bench/$task/$slug.mp4" \
    '{model:(.model|sub("^[^:]+:";"")), slug:$slug, qualified:(.qualified//false), cost:((.cost_usd//0)*1000|round/1000), wall_s:.wall_s, turns:(.turns//null), img:$img, video:$v, todo:(.todo//null)}' "$d/meta.json")")
done
jq -n --arg bench "$bench" --arg task "$task" --arg date "$(basename "$run" | cut -c1-10)" --arg prompt "$(cat "$run/prompt.txt" | head -1)" \
  --argjson runs "$(printf '%s\n' "${entries[@]}" | jq -s .)" '{bench:$bench, task:$task, date:$date, prompt:$prompt, runs:$runs}'
du -sh "$PUB" >&2
