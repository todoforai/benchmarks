#!/usr/bin/env bash
# ./timelapse.sh <rundir>  → <rundir>/timelapse.mp4 (see rec/timelapse.ts)
set -euo pipefail; cd "$(dirname "$0")"
d=$(readlink -f "$1"); m=$(jq -r '.model|sub(".*/";"")' "$d/meta.json" 2>/dev/null || true)
./sandbox.sh "$d" -- bun /rec/timelapse.ts /work "$m"
