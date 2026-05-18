#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
export TODOFORAI_API_KEYS_FILE="$PWD/dev_api_keys.txt"
TASK="${1:-terminal-bench/adaptive-rejection-sampler}"
JOB="${2:-gpt-5.5-xhigh__$(date +%Y-%m-%d__%H-%M-%S)}"
echo "JOB=$JOB TASK=$TASK"
exec ~/.todoforai/tools/venv/bin/harbor run \
  -d "terminal-bench/terminal-bench-2" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  -i "$TASK" \
  --yes -n 1 \
  --job-name "$JOB"
