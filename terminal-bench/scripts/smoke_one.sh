#!/bin/bash
# One-task smoke run, used to confirm the plumbing before spending hours on a
# full sweep: the account tier is ungated, the requested model is the one that
# actually serves the trial, and the verifier still awards the task.
# Usage: bash smoke_one.sh [task] [job-prefix]
set -u
cd "$(dirname "$0")/.." || exit 1
TASK="${1:-openssl-selfsigned-cert}"
PREFIX="${2:-smoke}"
MODEL="${TB_MODEL:-openai:openai/gpt-5.6-sol}"
HARBOR="${HARBOR_BIN:-$PWD/.venv/bin/harbor}"
JOB="${PREFIX}__$(date '+%F__%H-%M-%S')"
export TODOFORAI_API_KEYS_FILE="$PWD/dev_api_keys.txt"

echo "task=$TASK model=$MODEL job=$JOB"
docker ps -q | xargs -r docker rm -f >/dev/null 2>&1

"$HARBOR" run \
  -d "terminal-bench/terminal-bench-2" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  -m "$MODEL" \
  -i "terminal-bench/$TASK" \
  --job-name "jobs/$JOB" \
  --yes -n 1 > "jobs/$JOB.log" 2>&1

echo "-- reward: $(cat jobs/$JOB/*/verifier/reward.txt 2>/dev/null || echo none)"
echo "-- CLI header (model the CLI was asked for):"
head -1 jobs/$JOB/*/agent/todoforai-cli.txt 2>/dev/null | sed 's/^/   /'
echo "-- job dir: jobs/$JOB"
