#!/usr/bin/env bash
# Run the full terminal-bench task list in batches of N tasks.
# Usage: ./scripts/run_batches.sh [job-prefix] [batch-size] [n-concurrent]
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

PREFIX="${1:-gpt-5.6-sol-xhigh}"
BATCH="${2:-10}"
CONC="${3:-6}"
TASKS_FILE="${TASKS_FILE:-tasks_all.txt}"
export TODOFORAI_API_KEYS_FILE="$PWD/dev_api_keys.txt"

mapfile -t TASKS < <(grep -v '^\s*$' "$TASKS_FILE")
TOTAL=${#TASKS[@]}
echo "$(date '+%F %T') Running $TOTAL tasks in batches of $BATCH (concurrency $CONC)"

i=0
batch_no=1
while [ $i -lt $TOTAL ]; do
  ARGS=()
  for t in "${TASKS[@]:$i:$BATCH}"; do
    ARGS+=(-i "terminal-bench/$t")
  done
  JOB="${PREFIX}__batch$(printf '%02d' $batch_no)__$(date +%Y-%m-%d__%H-%M-%S)"
  echo "$(date '+%F %T') === batch $batch_no: tasks $((i+1))-$((i+${#ARGS[@]}/2)) -> jobs/$JOB"
  # clean stale containers from previous batch
  docker ps -q | xargs -r docker rm -f >/dev/null 2>&1
  ~/.todoforai/tools/venv/bin/harbor run \
    -d "terminal-bench/terminal-bench-2" \
    --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
    "${ARGS[@]}" \
    --job-name "$JOB" \
    --yes -n "$CONC" > "jobs/$JOB.log" 2>&1
  rc=$?
  rewards=$(cat jobs/"$JOB"/*/verifier/reward.txt 2>/dev/null | paste -sd' ')
  echo "$(date '+%F %T') batch $batch_no done rc=$rc rewards: $rewards"
  i=$((i+BATCH))
  batch_no=$((batch_no+1))
done
echo "$(date '+%F %T') ALL DONE"
