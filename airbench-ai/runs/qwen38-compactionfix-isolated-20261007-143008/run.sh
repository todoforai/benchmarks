#!/usr/bin/env bash
set -euo pipefail
R=$(cd "$(dirname "$0")" && pwd)
export TODOFORAI_API_TOKEN=$(NO_UPDATE_NOTIFIER=1 tfa-vault get api/todoforai -f api_key)
START=$(date +%s)
set +e
docker run --rm --name airbench-ai-qwen38 --cap-drop ALL --security-opt no-new-privileges --pids-limit 256 --memory 2g --cpus 2 \
 -e TODOFORAI_API_TOKEN -e TODOFORAI_API_URL=https://api.todofor.ai -e NO_UPDATE_NOTIFIER=1 \
 -v "$(readlink -f "$(command -v node)"):/usr/local/bin/node:ro" \
 -v "$HOME/.bun/install/global/node_modules:/opt/node_modules:ro" \
 -v "$(readlink -f "$(command -v todoforai-bridge)"):/usr/local/bin/todoforai-bridge:ro" \
 -v "$R:/run/bench:ro" -v "$R/workspace:/workspace:rw" -w /workspace \
 airbench-ai-isolated bash -c 'node /opt/node_modules/@todoforai/cli/bin/todoforai-cli.js --isolated --non-interactive --allow-all --path /workspace --agent 9b751aeb-eb3b-48c3-8e5d-4f823e977c7a --model deepinfra:qwen/qwen3.8-27b --project 8bb1ac61-0307-4fbd-a70f-eb3fa7951612 --raw-sysmsg /run/bench/system.txt < /run/bench/prompt.txt' > "$R/agent.log" 2>&1
CODE=$?
set -e
printf '{"exit_code":%s,"elapsed_seconds":%s,"benchmark":"https://airbench.ai/","model":"deepinfra:qwen/qwen3.8-27b","path":"TODOforAI CLI --isolated","allow_all":true,"scope":"Docker sandbox"}\n' "$CODE" "$(( $(date +%s) - START ))" > "$R/run.json"
T=$(grep -ao 'todofor.ai/t/[0-9a-f-]*' "$R/agent.log" | head -1 | cut -d/ -f3)
printf '%s\n' "$T" > "$R/todo-id.txt"
NO_UPDATE_NOTIFIER=1 todoforai-cli --inspect "$T" --json --detailed > "$R/messages.json"
cat "$R/run.json"; echo "todo=$T"
