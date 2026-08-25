#!/bin/bash
# Which model actually served the trials? The CLI header echoes what we ASKED
# for (-m), not what the backend dispatched -- a hobby-tier account is clamped
# to Sonnet server-side, which looks like "the benchmark got slower", not like
# an error. Ask the backend for each dev key's tier.
set -u
cd "$(dirname "$0")/.." || exit 1
URL="${TODOFORAI_API_URL:-https://api.todofor.ai}"

printf '%-34s %-10s %-9s %s\n' email tier status gated
while read -r key email; do
  [ -n "${key:-}" ] || continue
  case "$key" in \#*) continue ;; esac
  # REST, and the API key goes in x-api-key -- Bearer 401s.
  resp=$(curl -sS -m 20 -H "x-api-key: $key" \
    "$URL/api/v1/billing/subscription" 2>&1)
  tier=$(printf '%s' "$resp" | python3 -c 'import json,sys
raw=sys.stdin.read()
try:
    d=json.loads(raw)
    # tRPC wraps payloads in result.data (sometimes .json)
    for k in ("result","data","json"):
        if isinstance(d,dict) and k in d: d=d[k]
    print(d.get("tier","?"), d.get("status","?"))
except Exception:
    print("ERR", raw[:60].replace(" ","_"))' 2>/dev/null)
  set -- $tier
  gated="?"
  case "$1" in hobby|team_free) gated="YES -> Sonnet" ;; none|starter|pro|ultra|team|scale) gated="no" ;; esac
  printf '%-34s %-10s %-9s %s\n' "${email:-?}" "$1" "$2" "$gated"
done < dev_api_keys.txt
