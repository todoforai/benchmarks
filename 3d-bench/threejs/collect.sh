#!/usr/bin/env bash
# 3DBench three.js collect: qualify (loads, no console errors), 1280x800 shot + 20 s idle mp4,
# then perf (rec/perf.ts): fps, frame p95, draw calls, triangles, bytes, first-draw ms — on GPU and on SwiftShader.
# Serves "/" of the sandbox so /vendor/three@… resolves exactly as in the contract.
set -euo pipefail; d=$1; R="$(dirname "$(readlink -f "$0")")/../../runner"; cd "$R"
[ -f "$d/work/index.html" ] || { echo "   NO index.html"; jq '. + {qualified:false, reason:"no index.html"}' "$d/meta.json" >"$d/m.tmp" && mv "$d/m.tmp" "$d/meta.json"; exit 0; }
./sandbox.sh "$d/work" -- bun /rec/rec.ts /work/index.html /work/preview.mp4 --serve / --w 1280 --h 800 --secs 20 --script idle --shot /work/shot.png
q=true; r=""; [ -s "$d/work/preview.errors.txt" ] && { q=false; r=$(head -c 300 "$d/work/preview.errors.txt"); }
[ -s "$d/work/shot.png" ] || { q=false; r="no screenshot"; }
# perf.gpu = real GPU (Vulkan; vsync-capped, shows stalls only); perf.cpu = SwiftShader software raster,
# the load proxy: fps there scales with how much work a frame is.
pg=$(./sandbox.sh "$d/work" -- bun /rec/perf.ts /work/index.html --serve / --gpu 2>/dev/null | tail -1); echo "$pg" | jq -e . >/dev/null 2>&1 || pg=null
pc=$(./sandbox.sh "$d/work" -- bun /rec/perf.ts /work/index.html --serve / 2>/dev/null | tail -1); echo "$pc" | jq -e . >/dev/null 2>&1 || pc=null
jq --argjson q $q --arg r "$r" --argjson pg "$pg" --argjson pc "$pc" '. + {qualified:$q, reason:$r, perf:{gpu:$pg, cpu:$pc}}' "$d/meta.json" >"$d/m.tmp" && mv "$d/m.tmp" "$d/meta.json"
echo "   qualified=$q ${r:+($r)}"
