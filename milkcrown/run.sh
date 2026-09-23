#!/usr/bin/env bash
# MILKCROWN through the TODOforAI agent, same config as the pelican bench.
# One run per model; the agent writes milk.js, which lands in entries/<slug>.js.
#   ./run.sh [model ...]     default: sol, opus-5, sonnet-5
set -euo pipefail
cd "$(dirname "$0")"
: "${TODOFORAI_API_KEYS_FILE:=$PWD/../terminal-bench/dev_api_keys.txt}"
export PATH="$PWD/../terminal-bench/todoforai_tbench/dist:$PATH"
# TODOFORAI_API_TOKEN wins; otherwise take the first key from the file, which is
# written as "email=key" -- passing the whole line makes the CLI's websocket
# reject the subprotocol with a confusing SyntaxError.
KEY="${TODOFORAI_API_TOKEN:-$(grep -v '^#' "$TODOFORAI_API_KEYS_FILE" 2>/dev/null | head -1 | cut -d= -f2-)}"
[ -n "$KEY" ] || { echo "no api key: set TODOFORAI_API_TOKEN or fill $TODOFORAI_API_KEYS_FILE" >&2; exit 1; }
curl -sf -m 15 -H "x-api-key: $KEY" "${TODOFORAI_API_URL:-https://api.todofor.ai}/api/v1/billing/subscription" >/dev/null \
  || { echo "api key rejected -- check TODOFORAI_API_TOKEN / dev_api_keys.txt" >&2; exit 1; }

# AGENT: the terminal-bench dev accounts have an "app" agent (narrow tool set);
# a normal account does not, and --agent <missing> aborts the run.
AGENT="${MILKCROWN_AGENT:-}"
# Run in the caller's project unless told otherwise. Only wipe the inherited
# project id when the key is NOT the caller's own -- a foreign key writing into
# an inherited project id gets a 403.
PROJECT="${MILKCROWN_PROJECT:-${TODOFORAI_PROJECT_ID:-}}"
[ -n "${TODOFORAI_API_TOKEN:-}" ] || PROJECT="${MILKCROWN_PROJECT:-}"
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
      HOME="$(mktemp -d)" TODOFORAI_API_TOKEN="$KEY" timeout "${MILKCROWN_TIMEOUT:-3600}" \
      todoforai-cli --isolated --non-interactive --allow-all --path "$PWD" \
      ${PROJECT:+--project "$PROJECT"} ${AGENT:+--agent "$AGENT"} --model "$M" "$TASK" \
      > agent.log 2>&1 ) || echo "   exit=$? (see $d/agent.log)"
  [ -f "$d/milk.js" ] || cp /tmp/todoforai/milk.js "$d/" 2>/dev/null || true
  if [ -f "$d/milk.js" ]; then cp "$d/milk.js" "entries/$slug.js"; echo "   -> entries/$slug.js"
  else echo "   NO milk.js"; fi
done
echo "DONE $RUN"
node score.js
