#!/usr/bin/env bash
# MILKCROWN through the TODOforAI agent, same config as the pelican bench.
# One run per model; the agent writes milk.js, which lands in entries/<slug>.js.
#   ./run.sh [model ...]     default: sol, opus-5, sonnet-5
set -euo pipefail
cd "$(dirname "$0")"
: "${TODOFORAI_API_KEYS_FILE:=$PWD/../terminal-bench/dev_api_keys.txt}"
export PATH="$PWD/../terminal-bench/todoforai_tbench/dist:$PATH"
KEY=$(grep -v '^#' "$TODOFORAI_API_KEYS_FILE" | head -1 | awk '{print $1}')
[ -n "$KEY" ] || { echo "no api key in $TODOFORAI_API_KEYS_FILE" >&2; exit 1; }

MODELS=("$@"); [ ${#MODELS[@]} -gt 0 ] || MODELS=(openai:openai/gpt-5.6-sol anthropic:anthropic/claude-opus-5 anthropic:anthropic/claude-sonnet-5)
TASK=$(cat prompt.txt)

RUN="runs/$(date +%Y-%m-%d__%H-%M-%S)"; mkdir -p "$RUN"
for M in "${MODELS[@]}"; do
  slug=${M##*/}; d="$RUN/$slug"; mkdir -p "$d"
  echo "== $M -> $d"
  # Empty HOME + unset TODOFORAI_* : an agent shell would otherwise inherit the
  # caller's project/todo ids and 403 under a different API key.
  ( cd "$d" && env -u TODOFORAI_PROJECT_ID -u TODOFORAI_TODO_ID -u TODOFORAI_AGENT_SETTINGS_ID \
      -u TODOFORAI_MESSAGE_ID -u TODOFORAI_BLOCK_ID -u TODOFORAI_API_URL \
      HOME="$(mktemp -d)" TODOFORAI_API_TOKEN="$KEY" timeout 1800 \
      todoforai-cli --isolated --non-interactive --allow-all --path "$PWD" --agent app --model "$M" "$TASK" \
      > agent.log 2>&1 ) || echo "   exit=$? (see $d/agent.log)"
  [ -f "$d/milk.js" ] || cp /tmp/todoforai/milk.js "$d/" 2>/dev/null || true
  if [ -f "$d/milk.js" ]; then cp "$d/milk.js" "entries/$slug.js"; echo "   -> entries/$slug.js"
  else echo "   NO milk.js"; fi
done
echo "DONE $RUN"
node score.js
