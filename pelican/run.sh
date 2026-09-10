#!/usr/bin/env bash
# Simon Willison's pelican benchmark through the TODOforAI agent with the
# Terminal-Bench 82% config (--isolated --agent app = Sol xhigh + narrow tool set).
# One run per model; the agent writes pelican.svg in its run dir.
#   ./run.sh [model ...]        default: sol, opus-5, sonnet-5
set -euo pipefail
cd "$(dirname "$0")"
: "${TODOFORAI_API_KEYS_FILE:=$PWD/../terminal-bench/dev_api_keys.txt}"
export PATH="$PWD/../terminal-bench/todoforai_tbench/dist:$PATH"   # same binaries the tbench containers get
KEY=$(grep -v '^#' "$TODOFORAI_API_KEYS_FILE" | head -1 | awk '{print $1}')
[ -n "$KEY" ] || { echo "no api key in $TODOFORAI_API_KEYS_FILE" >&2; exit 1; }

MODELS=("$@"); [ ${#MODELS[@]} -gt 0 ] || MODELS=(openai:openai/gpt-5.6-sol anthropic:anthropic/claude-opus-5 anthropic:anthropic/claude-sonnet-5)
TASK='Generate an SVG of a California brown pelican riding a bicycle. The bicycle must have spokes and a correctly shaped bicycle frame. The pelican must have its characteristic large pouch, and there should be a clear indication of feathers. The pelican must be clearly pedaling the bicycle. The image should show the full breeding plumage of the California brown pelican. Save it as pelican.svg in the current directory. Do not use any external tool, image model or library to draw it: write the SVG by hand, as a single file, and finish.'

RUN="runs/$(date +%Y-%m-%d__%H-%M-%S)"; mkdir -p "$RUN"; printf '%s\n' "$TASK" > "$RUN/prompt.txt"
for M in "${MODELS[@]}"; do
  slug=${M##*/}; d="$RUN/$slug"; mkdir -p "$d"
  echo "== $M -> $d"
  # Empty HOME: the CLI prefers ~/.todoforai/credentials.json over the env token.
  # --api-key would put the key into argv/logs.
  # env -u: an agent shell inherits TODOFORAI_PROJECT_ID/TODO_ID/AGENT_SETTINGS_ID of
  # the *calling* account; with a different API key that's a 403 "Unauthorized to modify project".
  ( cd "$d" && env -u TODOFORAI_PROJECT_ID -u TODOFORAI_TODO_ID -u TODOFORAI_AGENT_SETTINGS_ID \
      -u TODOFORAI_MESSAGE_ID -u TODOFORAI_BLOCK_ID -u TODOFORAI_API_URL \
      HOME="$(mktemp -d)" TODOFORAI_API_TOKEN="$KEY" timeout 1800 \
      todoforai-cli --isolated --non-interactive --allow-all --path "$PWD" --agent app --model "$M" "$TASK" \
      > agent.log 2>&1 ) || echo "   exit=$? (see $d/agent.log)"
  # The isolated bridge runs bash in its own workspace (/tmp/todoforai), not --path,
  # so the file usually lands there; pull it back into the run dir.
  [ -f "$d/pelican.svg" ] || cp /tmp/todoforai/pelican.svg "$d/" 2>/dev/null || true
  [ -f "$d/pelican.svg" ] && ./render.sh "$d/pelican.svg" || echo "   NO pelican.svg"
done
echo "DONE $RUN"
