#!/bin/bash
# Collect tasks whose trials were damaged by infrastructure, not by the agent:
#   - the edge saw "Server restarting" (backend deploy mid-trial)
#   - the trial has no reward at all (runner was killed under it)
# Prints one task name per line -> feed to run_batches.sh via TASKS_FILE.
# Tasks lost with no trial dir at all (runner killed as a process group, the
# half-written dirs were removed) can't be detected here -- they are listed in
# lost_tasks.txt next to this script and merged in.
# Usage: bash scripts/failed_tasks.sh [job-prefix] > rerun.txt
set -u
PREFIX="${1:-tb21-gpt-5.6-sol-xhigh-ultra}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../jobs" || exit 1

for d in "$PREFIX"__batch*/*/ ; do
  [ -d "$d" ] || continue
  task=$(basename "$d" | sed 's/__[A-Za-z0-9]*$//')
  reward=$(cat "$d/verifier/reward.txt" 2>/dev/null)
  # A pass stands even if the backend blinked: the work still finished.
  [ "$reward" = "1" ] && continue
  # No reward yet + no result.json = still running; not a casualty.
  if [ -z "$reward" ] && [ ! -f "$d/result.json" ]; then
    continue
  fi
  if [ -z "$reward" ] || grep -q "Server restarting" "$d/agent/edge.txt" 2>/dev/null; then
    echo "$task"
  fi
done | cat - <(grep -hv '^[[:space:]]*\(#\|$\)' "$SCRIPT_DIR/lost_tasks.txt" 2>/dev/null) | sort -u
