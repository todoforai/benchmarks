#!/usr/bin/env bash
# Add cost_usd, models_used, turns + token totals to <run>/meta.json from the todo itself (re-runnable later).
#   ./metrics.sh <run-dir> [api-key]      key: the dev account that ran it
# cost_usd = tokens x the provider's published list price (frontend/src/assets/models_data.json,
#   first-party endpoint), NOT what TODO for AI billed: billing applies our promos (agent/src/model_promos.jl),
#   which nobody else can reproduce. billed_usd keeps the billed sum for reference.
# models_used = every extras.model seen (provider:id(level)) — check it matches the requested model.
set -euo pipefail; cd "$(dirname "$0")"; d=$1; K=${2:-${TODOFORAI_API_TOKEN:?key}}
id=$(grep -oEm1 'todofor\.ai/t/[0-9a-f-]{36}' "$d/agent.log" | cut -d/ -f3)
PRICES=$(jq -c '[.models | (if type=="array" then .[] else to_entries[].value end)
  | {key: .id, value: ((.id | split("/")[0]) as $p | ([.endpoints[] | select(.tag == $p)] + [.endpoints[] | select(.tag | startswith($p + "/"))] + .endpoints)[0].pricing)}]
  | from_entries' ../../frontend/src/assets/models_data.json)
m=$(todoforai-cli --inspect "$id" --json --debug --api-key "$K" 2>/dev/null | jq -c --arg id "$id" --argjson P "$PRICES" '
  def price(e): (e.model // "" | sub("^[^:]+:"; "") | sub("\\([^)]*\\)$"; "")) as $k | $P[$k] as $p
    | if $p == null then null else (e.inputTokens // 0) * ($p.prompt // 0) + (e.outputTokens // 0) * ($p.completion // 0)
      + (e.cacheReadTokens // 0) * ($p.input_cache_read // $p.prompt // 0) + (e.cacheWriteTokens // 0) * ($p.input_cache_write // $p.prompt // 0) end;
  [.. | objects | .runMeta[]?] as $all | ($all | map(select(.type == "todo:msg_meta_ai"))) as $ai
  | ($all | map(price(.extras // {}))) as $lp
  | {todo: ("https://todofor.ai/t/" + $id), cost_usd: (if any($lp[]; . == null) then null else ($lp | add) end),
     billed_usd: ($all | map(.cost // 0) | add), models_used: ($all | map(.extras.model // empty) | unique), turns: ($ai | length),
     tokens: {input: ($ai | map(.extras.inputTokens // 0) | add), output: ($ai | map(.extras.outputTokens // 0) | add),
              cache_read: ($ai | map(.extras.cacheReadTokens // 0) | add), cache_write: ($ai | map(.extras.cacheWriteTokens // 0) | add),
              context_max: ($ai | map(.extras.contextTokens // 0) | max)}}')
pub=$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H "x-api-key: $K" -H 'content-type: application/json' \
  -d '{"isPublic":true}' "https://api.todofor.ai/api/v1/todos/$id")   # replay link on /bench; 403 = key isn't the todo owner
m=$(jq -c --argjson p "$([ "$pub" = 200 ] && echo true || echo false)" '. + {todo_public: $p}' <<<"$m")
jq --argjson m "$m" '. + $m' "$d/meta.json" > "$d/meta.json.tmp" && mv "$d/meta.json.tmp" "$d/meta.json"
echo "   $m"
