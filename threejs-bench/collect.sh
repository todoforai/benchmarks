#!/usr/bin/env bash
# ThreeJSBench collect: qualify (loads, no console errors), 1280x800 shot + 20 s idle mp4.
# Serves "/" of the sandbox so /vendor/three@… resolves exactly as in the contract.
set -euo pipefail; d=$1; R="$(dirname "$(readlink -f "$0")")/../runner"; cd "$R"
[ -f "$d/work/index.html" ] || { echo "   NO index.html"; jq '. + {qualified:false, reason:"no index.html"}' "$d/meta.json" >"$d/m.tmp" && mv "$d/m.tmp" "$d/meta.json"; exit 0; }
./sandbox.sh "$d/work" -- bun /rec/rec.ts /work/index.html /work/preview.mp4 --serve / --w 1280 --h 800 --secs 20 --script idle --shot /work/shot.png
q=true; r=""; [ -s "$d/work/preview.errors.txt" ] && { q=false; r=$(head -c 300 "$d/work/preview.errors.txt"); }
[ -s "$d/work/shot.png" ] || { q=false; r="no screenshot"; }
jq --argjson q $q --arg r "$r" '. + {qualified:$q, reason:$r}' "$d/meta.json" >"$d/m.tmp" && mv "$d/m.tmp" "$d/meta.json"
echo "   qualified=$q ${r:+($r)}"
