#!/usr/bin/env bash
# Social-post renders (NOT for the site): re-record published bench pages with the virtual clock (rec/vclock.ts): every frame exactly 1/fps, no jank.
#   ./rerender.sh <outdir> [bench/task ...]     default: every task under frontend/public/bench
# Env: SECS=30 FPS=30 W=1280 H=800 PAR=3. Skips existing outputs (rerun = resume). Out: <outdir>/<bench>/<task>/<slug>.mp4
set -euo pipefail; cd "$(dirname "$0")"
OUT=$(readlink -f "${1:?outdir}"); shift
PUB=$(readlink -f ../../frontend/public/bench)
: "${SECS:=30}" "${FPS:=30}" "${W:=1280}" "${H:=800}" "${PAR:=3}"
tasks=("$@"); [ ${#tasks[@]} -gt 0 ] || mapfile -t tasks < <(cd "$PUB" && ls -d */*/ | sed 's:/$::')
for t in "${tasks[@]}"; do for h in "$PUB/$t"/*.html; do [ -e "$h" ] && echo "$t/$(basename "$h" .html)"; done; done |
  OUT=$OUT PUB=$PUB SECS=$SECS FPS=$FPS W=$W H=$H xargs -P "$PAR" -I{} bash -c '
    o=$OUT/{}.mp4; [ -s "$o" ] && exit 0; mkdir -p "$(dirname "$o")"
    (cd rec && bun vclock.ts /{}.html "$o.tmp.mp4" --serve "$PUB" --secs $SECS --fps $FPS --w $W --h $H --gpu >/dev/null 2>"$o.err") \
      && mv "$o.tmp.mp4" "$o" && rm -f "$o.err" && echo "ok   {}" || echo "FAIL {} (see $o.err)"'
