#!/usr/bin/env bash
# SVGBench collect: still frame (svg2png, viewBox size) → work/shot.png, 6 s recording → work/preview.mp4; qualified = it rendered.
set -euo pipefail; d=$1; cd "$(dirname "$(readlink -f "$0")")/../../../runner"
./svg2png.sh "$d" pelican.svg
q=false; r="no pelican.svg"
if [ -s "$d/work/pelican.png" ]; then
  cp "$d/work/pelican.png" "$d/work/shot.png"; q=true; r=""
  read -r w h < <(python3 -c 'import sys;from PIL import Image;w,h=Image.open(sys.argv[1]).size;k=max(1,800/w);print(round(w*k)//2*2,round(h*k)//2*2)' "$d/work/pelican.png")
  # (scaled to ≥800 px wide: tiny viewports gave no screencast frames). CDP screencast emits no frames for a bare SVG document → wrap it in a page (<img> keeps SMIL/CSS animation running)
  echo "<body style=margin:0><img src=pelican.svg width=$w height=$h style=display:block>" > "$d/work/rec.html"
  ./sandbox.sh "$d/work" -- bun /rec/rec.ts /work/rec.html /work/preview.mp4 --serve / --w "$w" --h "$h" --secs 6 --script idle || echo "   rec failed"
fi
jq --argjson q $q --arg r "$r" '. + {qualified:$q, reason:$r}' "$d/meta.json" >"$d/m.tmp" && mv "$d/m.tmp" "$d/meta.json"
echo "   qualified=$q ${r:+($r)}"
