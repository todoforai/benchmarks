#!/bin/bash
# Isolated-CLI smoke: run one --isolated task with a wrapped bridge that logs its exit code.
# Usage (WSL): TODOFORAI_API_TOKEN=<key> ./iso_smoke.sh
set -u

BRIDGE_BIN=/mnt/c/repo/todoforai/bridge/build/todoforai-bridge
CLI=/mnt/c/repo/todoforai/cli/src/index.ts
WS=$HOME/iso-smoke

mkdir -p "$HOME/wrap" "$WS"
cat > "$HOME/wrap/todoforai-bridge" <<WRAP
#!/bin/bash
$BRIDGE_BIN "\$@" 2>> $WS/bridge_stderr.log
ec=\$?
echo "BRIDGE_EXIT code=\$ec args=\$*" >> $WS/bridge_exit.log
exit \$ec
WRAP
chmod +x "$HOME/wrap/todoforai-bridge"

cd "$WS"
rm -f hello.txt bridge_exit.log bridge_stderr.log
# Explicit --api-key: the bridge writes a dst_… session token into
# credentials.json, which outranks TODOFORAI_API_TOKEN in the CLI's key
# resolution but does NOT authenticate on /api/v1 (subscribe → 401 →
# "Interrupted" → mayfly killed). The flag is the highest-precedence source.
PATH="$HOME/wrap:$PATH" "$HOME/.bun/bin/bun" "$CLI" \
  -n --isolated --debug --path "$WS" --api-key "$TODOFORAI_API_TOKEN" \
  'Create hello.txt in the workspace containing exactly: hi-isolated. Then stop.' 2>&1 | tail -15

echo "=== bridge_exit.log"
cat bridge_exit.log 2>/dev/null
echo "=== bridge_stderr tail"
tail -10 bridge_stderr.log 2>/dev/null
echo "=== workspace"
cat hello.txt 2>/dev/null || echo NO_FILE
