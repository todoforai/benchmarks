#!/usr/bin/env bash
# Add cost_usd + turns to <run>/meta.json from the todo itself (re-runnable later).
#   ./metrics.sh <run-dir> [api-key]      key: the dev account that ran it
# cost_usd = sum of runMeta.cost = what TODO for AI billed (incl. promos), not list price.
set -euo pipefail; d=$1; K=${2:-${TODOFORAI_API_TOKEN:?key}}
id=$(grep -oEm1 'todofor\.ai/t/[0-9a-f-]{36}' "$d/agent.log" | cut -d/ -f3)
m=$(todoforai-cli --inspect "$id" --json --debug --api-key "$K" 2>/dev/null | jq -c --arg id "$id" \
  '[.. | objects | .runMeta[]?] | {todo: ("https://todofor.ai/t/" + $id), cost_usd: (map(.cost // 0) | add), turns: map(select(.type == "todo:msg_meta_ai")) | length}')
jq --argjson m "$m" '. + $m' "$d/meta.json" > "$d/meta.json.tmp" && mv "$d/meta.json.tmp" "$d/meta.json"
echo "   $m"
