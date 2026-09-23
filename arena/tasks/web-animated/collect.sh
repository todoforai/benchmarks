#!/usr/bin/env bash
# hero screenshot + 12 s scroll recording (headless CDP screencast, no display)
set -euo pipefail; d=$1; cd "$(dirname "$0")/../.."
[ -f "$d/work/index.html" ] || { echo "   NO index.html"; exit 0; }
./sandbox.sh "$d/work" -- bun /rec/rec.ts file:///work/index.html /work/record.mp4 --shot /work/hero.png --script "${REC_SCRIPT:-scroll}"
