#!/bin/bash
# Archive the full backend conversation of every trial: every message, tool
# call and result -- the "which step did the AI take and why" record that a
# future run will be compared against. The reward alone can't answer that, and
# the backend todos are not guaranteed to live forever, so pull them now.
# A todo is only readable by the pool account that owns it -> try every key.
# Usage: bash scripts/archive_trajectories.sh [manifest] [outdir]
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1
MANIFEST="${1:-trajectories_manifest.txt}"
OUT="${2:-trajectories}"
URL="${TODOFORAI_API_URL:-https://api.todofor.ai}"
mapfile -t KEYS < <(awk 'NF && $1 !~ /^#/ {print $1}' dev_api_keys.txt)

mkdir -p "$OUT"
ok=0; fail=0; skip=0
while read -r run task trial reward todo dev; do
  case "$run" in \#*|"") continue ;; esac
  [ "$todo" = "-" ] && { skip=$((skip+1)); continue; }
  f="$OUT/${run}__${trial}.json"
  [ -s "$f" ] && { ok=$((ok+1)); continue; }   # resumable
  got=""
  for KEY in "${KEYS[@]}"; do
    body=$(curl -sS -m 60 -H "x-api-key: $KEY" "$URL/api/v1/todos/$todo/messages" 2>/dev/null)
    # Owned by another account -> error payload; success is a list/obj with messages.
    case "$body" in
      *'"messages"'*|\[*) printf '%s' "$body" > "$f"; got=1; break ;;
    esac
  done
  if [ -n "$got" ]; then ok=$((ok+1)); else fail=$((fail+1)); echo "FAILED $trial todo=$todo"; fi
done < "$MANIFEST"
echo "archived=$ok failed=$fail no-todo-id=$skip -> $OUT/"
