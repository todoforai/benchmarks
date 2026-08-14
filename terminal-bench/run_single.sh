#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
: "${TODOFORAI_API_KEYS_FILE:=$PWD/dev_api_keys.txt}"
export TODOFORAI_API_KEYS_FILE
TASK="${1:-terminal-bench/adaptive-rejection-sampler}"
JOB="${2:-gpt-5.5-xhigh__$(date +%Y-%m-%d__%H-%M-%S)}"
echo "JOB=$JOB TASK=$TASK"
# Validate credentials before spending container time.
"$PWD/.venv/bin/python" -c 'from todoforai_tbench.harbor_agent import preflight; preflight()'
exec "$PWD/.venv/bin/harbor" run \
  -d "${TB_DATASET:-terminal-bench/terminal-bench-2}" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  ${TB_MODEL:+-m "$TB_MODEL"} \
  -i "$TASK" \
  --yes -n 1 \
  --job-name "$JOB"
