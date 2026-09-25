#!/bin/bash
# Is the bench account on a paid tier? A hobby-tier account is clamped to
# Sonnet server-side, which looks like "the benchmark got slower", not an error.
set -u
cd "$(dirname "$0")/.." || exit 1
URL="${TODOFORAI_API_URL:-https://api.todofor.ai}"
KEY="${TODOFORAI_API_KEY:-$(awk 'NF && $1 !~ /^#/ {print $1; exit}' dev_api_keys.txt | tr -d '\r')}"
# REST, and the API key goes in x-api-key -- Bearer 401s.
curl -sS -m 20 -H "x-api-key: $KEY" "$URL/api/v1/billing/subscription" | python3 -c 'import json,sys
d=json.load(sys.stdin)
for k in ("result","data","json"):
    if isinstance(d,dict) and k in d: d=d[k]
t=d.get("tier","?")
print("tier:", t, "status:", d.get("status","?"), "->", "GATED to Sonnet" if t in ("hobby","team_free") else "ok")
sys.exit(1 if t in ("hobby","team_free","?") else 0)'
