#!/usr/bin/env bash
#
# Build todoai CLI and todoforai-edge dist files for use in terminal-bench Docker containers.
#
# Usage: ./scripts/rebuild_wheels.sh
#
# Prerequisites:
#   - bun installed
#   - Source repos at expected paths (see CLI_DIR / EDGE_DIR below)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
DIST_DIR="$PROJECT_DIR/todoforai_tbench/dist"

MONOREPO_DIR="$(cd "$PROJECT_DIR/../.." && pwd)"
CLI_DIR="${CLI_DIR:-$MONOREPO_DIR/cli}"
EDGE_DIR="${EDGE_DIR:-$MONOREPO_DIR/edge/bun}"

echo "=== Building dist files ==="
echo "  cli:   $CLI_DIR"
echo "  edge:  $EDGE_DIR"
echo "  output: $DIST_DIR"
echo ""

mkdir -p "$DIST_DIR"
rm -f "$DIST_DIR"/*.js

# Build todoai CLI bundle
if [ -d "$CLI_DIR" ]; then
  echo "Building todoai.js..."
  cd "$CLI_DIR"
  bun install --silent
  bun build src/index.ts --target=bun --outfile "$DIST_DIR/todoai.js" --external ws
  chmod +x "$DIST_DIR/todoai.js"
  echo "  -> $DIST_DIR/todoai.js ($(du -sh "$DIST_DIR/todoai.js" | cut -f1))"
else
  echo "WARNING: $CLI_DIR not found, skipping todoai CLI"
fi

# Build todoforai-edge bundle
if [ -d "$EDGE_DIR" ]; then
  echo "Building todoforai-edge.js..."
  cd "$EDGE_DIR"
  bun install --silent
  bun build src/index.ts --target=bun --outfile "$DIST_DIR/todoforai-edge.js"
  chmod +x "$DIST_DIR/todoforai-edge.js"
  echo "  -> $DIST_DIR/todoforai-edge.js ($(du -sh "$DIST_DIR/todoforai-edge.js" | cut -f1))"
else
  echo "WARNING: $EDGE_DIR not found, skipping todoforai-edge"
fi

echo ""
echo "=== Done ==="
ls -lh "$DIST_DIR"/*.js 2>/dev/null || echo "No dist files found!"
