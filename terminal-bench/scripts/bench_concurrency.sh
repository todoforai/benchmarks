#!/usr/bin/env bash
# Concurrency benchmark: the same task set at several -n levels, one harbor call
# per level (no batching), sampling host load while it runs.
# Usage: scripts/bench_concurrency.sh <tasks-file> <prefix> <n1> [n2 ...]
# Output: jobs/<prefix>__n<N>/ (harbor job) + jobs/<prefix>__n<N>.samples.csv
# Never run next to another sweep: it removes all docker containers per level.
set -uo pipefail
cd "$(dirname "$0")/.."
TASKS_FILE="${1:?tasks file}"; PREFIX="${2:?prefix}"; shift 2
MODEL="${TB_MODEL:-openai:openai/gpt-5.6-sol}"
HARBOR="${HARBOR_BIN:-$PWD/.venv/bin/harbor}"
mapfile -t TASKS < <(grep -v '^\s*$' "$TASKS_FILE")
ARGS=(); for t in "${TASKS[@]}"; do ARGS+=(-i "terminal-bench/$t"); done

for N in "$@"; do
  [ -f jobs/STOP ] && { echo "$(date '+%F %T') STOP present, not starting n=$N"; exit 0; }
  JOB="${PREFIX}__n${N}"
  docker ps -q | xargs -r docker rm -f >/dev/null 2>&1
  docker network prune -f >/dev/null 2>&1
  S="jobs/$JOB.samples.csv"
  echo "ts,containers,mem_used_gb,load1" > "$S"
  ( while :; do
      echo "$(date +%s),$(docker ps -q | wc -l),$(free -g | awk '/^Mem/{print $3}'),$(cut -d' ' -f1 /proc/loadavg)" >> "$S"
      sleep 10
    done ) & SAMPLER=$!
  t0=$(date +%s)
  echo "$(date '+%F %T') === n=$N (${#TASKS[@]} tasks) -> jobs/$JOB"
  "$HARBOR" run -d "terminal-bench/terminal-bench-2-1" \
    --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" -m "$MODEL" \
    "${ARGS[@]}" --job-name "$JOB" --yes -n "$N" > "jobs/$JOB.log" 2>&1
  rc=$?; kill $SAMPLER 2>/dev/null
  pass=$(cat jobs/"$JOB"/*/verifier/reward.txt 2>/dev/null | grep -c '^1')
  echo "$(date '+%F %T') n=$N done rc=$rc wall=$(( $(date +%s)-t0 ))s pass=$pass/${#TASKS[@]}"
done
echo "$(date '+%F %T') ALL DONE"
