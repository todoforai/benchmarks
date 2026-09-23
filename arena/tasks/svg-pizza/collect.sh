#!/usr/bin/env bash
# still (t=0) png + 4 s frame-exact render of the SMIL/CSS animation
set -euo pipefail; d=$1; cd "$(dirname "$0")/../.."
"$(dirname "$0")/../../svg2png.sh" "$d" pizza.svg
[ -f "$d/work/pizza.svg" ] && ./sandbox.sh "$d/work" -- bun /rec/frames.ts /work/pizza.svg /work/pizza.mp4 --secs 4 --fps 30 --w 960 --h 540 || true
