#!/usr/bin/env bash
# Rebuild frontend/src/data/bench-results.json from every run of the given benches (default: threejs-bench).
# One entry per <bench>/<task>; per model the most recent run wins. Media lands via export.sh.
#   ./publish.sh [bench...]
set -euo pipefail; cd "$(dirname "$0")"
OUT=../../frontend/src/data/bench-results.json
for b in "${@:-threejs-bench}"; do
  for r in $(ls -d runs/"$b"_*/*/ 2>/dev/null | sort); do ./export.sh "$r" 2>/dev/null; done   # ts-named dirs → chronological
done | jq -s 'group_by(.bench + "/" + .task) | map(. as $g | $g[-1] + {date: ($g | map(.date) | max),
  runs: ($g | map(.runs) | add | reverse | unique_by(.model))})' > "$OUT"
jq -r '.[] | "\(.bench)/\(.task): \(.runs | length) models"' "$OUT"
