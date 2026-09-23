#!/usr/bin/env bash
# final render: seek window.tl frame by frame at 30 fps + music → promo.mp4
set -euo pipefail; d=$1; cd "$(dirname "$0")/../.."
[ -f "$d/work/index.html" ] || { echo "   NO index.html"; exit 0; }
./sandbox.sh "$d/work" -- bun /rec/frames.ts /work/index.html /work/promo.mp4 --fps 30 --audio /work/music.mp3
