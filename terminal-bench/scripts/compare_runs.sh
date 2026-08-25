#!/bin/bash
# Compare the same tasks across runs: reward + agent log size + failure kind.
# Usage: bash compare_runs.sh <task-name> [<task-name>...]
set -u
cd "$(dirname "$0")/../jobs" || exit 1

for t in "$@"; do
  echo "=== $t"
  for j in */"$t"__*; do
    [ -d "$j" ] || continue
    job=${j%%/*}
    reward=$(cat "$j/verifier/reward.txt" 2>/dev/null || echo "-")
    lines=$(wc -l < "$j/agent/todoforai-cli.txt" 2>/dev/null || echo 0)
    kind=""
    [ -f "$j/exception.txt" ] && kind=$(grep -oE '[A-Za-z]+Error' "$j/exception.txt" | tail -1)
    printf '  %-52s reward=%-3s lines=%-6s %s\n' "$job" "$reward" "$lines" "$kind"
  done
done
