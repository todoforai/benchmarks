#!/usr/bin/env bash
#
# Build compiled todoforai-cli + todoforai-bridge binaries for terminal-bench
# Docker containers. CLI via `bun build --compile`, bridge as a static musl
# binary (`make static`, needs zig) so it runs in any task image.
#
# Usage: ./scripts/rebuild_binaries.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
DIST_DIR="$PROJECT_DIR/todoforai_tbench/dist"

MONOREPO_DIR="$(cd "$PROJECT_DIR/../.." && pwd)"
CLI_DIR="${CLI_DIR:-$MONOREPO_DIR/cli}"
BRIDGE_DIR="${BRIDGE_DIR:-$MONOREPO_DIR/bridge}"

echo "=== Building compiled binaries ==="
echo "  cli:    $CLI_DIR"
echo "  bridge: $BRIDGE_DIR"
echo "  output: $DIST_DIR"
echo ""

mkdir -p "$DIST_DIR"

cd "$BRIDGE_DIR"
make -s static
cp build/todoforai-bridge-static "$DIST_DIR/todoforai-bridge"
echo "  -> $DIST_DIR/todoforai-bridge ($(du -sh "$DIST_DIR/todoforai-bridge" | cut -f1))"

cd "$CLI_DIR"
bun install --silent
bun build src/index.ts --compile --outfile "$DIST_DIR/todoforai-cli"
echo "  -> $DIST_DIR/todoforai-cli ($(du -sh "$DIST_DIR/todoforai-cli" | cut -f1))"

echo ""
echo "=== Done ==="
ls -lh "$DIST_DIR"/todoforai-cli "$DIST_DIR"/todoforai-bridge
