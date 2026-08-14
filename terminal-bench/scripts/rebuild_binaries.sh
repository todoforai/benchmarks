#!/usr/bin/env bash
#
# Build compiled todoforai-cli + todoforai-edge binaries for terminal-bench Docker containers.
# Uses `bun build --compile` so containers need no bun/npm/curl at runtime.
#
# Usage: ./scripts/rebuild_binaries.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
DIST_DIR="$PROJECT_DIR/todoforai_tbench/dist"

MONOREPO_DIR="$(cd "$PROJECT_DIR/../.." && pwd)"
CLI_DIR="${CLI_DIR:-$MONOREPO_DIR/cli}"
EDGE_DIR="${EDGE_DIR:-$MONOREPO_DIR/edge/bun}"

echo "=== Building compiled binaries ==="
echo "  cli:    $CLI_DIR"
echo "  edge:   $EDGE_DIR"
echo "  output: $DIST_DIR"
echo ""

mkdir -p "$DIST_DIR"

cd "$EDGE_DIR"
bun install --silent
bun build src/index.ts --compile --outfile "$DIST_DIR/todoforai-edge"
echo "  -> $DIST_DIR/todoforai-edge ($(du -sh "$DIST_DIR/todoforai-edge" | cut -f1))"

cd "$CLI_DIR"
bun install --silent
bun build src/index.ts --compile --outfile "$DIST_DIR/todoforai-cli"
echo "  -> $DIST_DIR/todoforai-cli ($(du -sh "$DIST_DIR/todoforai-cli" | cut -f1))"

echo ""
echo "=== Done ==="
ls -lh "$DIST_DIR"/todoforai-cli "$DIST_DIR"/todoforai-edge
