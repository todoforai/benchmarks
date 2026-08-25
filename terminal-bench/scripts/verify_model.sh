#!/bin/bash
# Which model actually answered? Read it off the assistant messages, not off the
# todo (which carries no model field) and not off the CLI header (which only
# echoes what we asked for). A gated account is clamped server-side silently,
# so this is the only honest check that a run measured the model we intended.
# Usage: bash verify_model.sh <job-dir>
set -u
cd "$(dirname "$0")/.." || exit 1
JOB="${1:?usage: verify_model.sh <job-dir>}"
URL="${TODOFORAI_API_URL:-https://api.todofor.ai}"
KEY=$(awk 'NF && $1 !~ /^#/ {print $1; exit}' dev_api_keys.txt)

for log in "$JOB"/*/agent/todoforai-cli.txt; do
  [ -f "$log" ] || continue
  trial=$(basename "$(dirname "$(dirname "$log")")")
  asked=$(head -1 "$log" | grep -o 'Model: .*' | cut -d' ' -f2-)
  todo=$(grep -o 'todofor.ai/t/[a-f0-9-]*' "$log" | head -1 | sed 's|.*/t/||')
  served="(no todo id)"
  if [ -n "$todo" ]; then
    served=$(curl -sS -m 30 -H "x-api-key: $KEY" "$URL/api/v1/todos/$todo/messages" 2>/dev/null \
      | python3 -c '
import json, sys
from collections import Counter
try:
    d = json.load(sys.stdin)
except Exception:
    print("(fetch failed)"); raise SystemExit
msgs = d if isinstance(d, list) else d.get("messages", [])
seen = Counter()
def scan(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k.lower() in ("model", "modelname", "modelid") and isinstance(v, str) and v:
                seen[v] += 1
            else:
                scan(v)
    elif isinstance(o, list):
        for v in o: scan(v)
scan(msgs)
print(", ".join(f"{m} x{c}" for m, c in seen.most_common(3)) or "(no model in messages)")' 2>/dev/null)
  fi
  printf '%-38s\n  asked : %s\n  served: %s\n' "${trial:0:38}" "$asked" "$served"
done
