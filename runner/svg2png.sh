#!/usr/bin/env bash
# <file.svg> -> <file.png> at the SVG's own viewBox size (fixed window crops),
# headless Chrome inside the sandbox. Usage: ./svg2png.sh <rundir> <name.svg>
set -euo pipefail; cd "$(dirname "$0")"
d=$1 f=$2; [ -f "$d/work/$f" ] || { echo "   NO $f"; exit 0; }
./sandbox.sh "$d/work" -- bash -c 'f='"$f"'
  read -r w h < <(head -c 800 "$f" | tr "\n" " " | sed -n "s/.*viewBox=\"[-0-9.]* [-0-9.]* \([0-9.]*\) \([0-9.]*\)\".*/\1 \2/p")
  w=${w%.*}; h=${h%.*}; google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --window-size="${w:-1000},${h:-700}" --screenshot="/work/${f%.svg}.png" "file:///work/$f" >/dev/null 2>&1
  echo "   ${f%.svg}.png ${w}x${h}"'
