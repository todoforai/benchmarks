#!/usr/bin/env bash
# SVGBench collect: rasterize pelican.svg at its viewBox (headless Chrome) → work/shot.png; qualified = it rendered.
set -euo pipefail; d=$1; cd "$(dirname "$(readlink -f "$0")")/../../../runner"
./svg2png.sh "$d" pelican.svg
q=false; r="no pelican.svg"; [ -s "$d/work/pelican.png" ] && { cp "$d/work/pelican.png" "$d/work/shot.png"; q=true; r=""; }
jq --argjson q $q --arg r "$r" '. + {qualified:$q, reason:$r}' "$d/meta.json" >"$d/m.tmp" && mv "$d/m.tmp" "$d/meta.json"
echo "   qualified=$q ${r:+($r)}"
