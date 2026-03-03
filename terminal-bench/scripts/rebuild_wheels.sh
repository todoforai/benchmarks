#!/usr/bin/env bash
#
# Rebuild todoai-cli and todoforai-edge-cli wheels and copy them to
# todoforai_tbench/wheels/ for use in terminal-bench Docker containers.
#
# Usage: ./scripts/rebuild_wheels.sh
#
# Prerequisites:
#   - python3 with 'build' module (pip install build)
#   - Source repos at expected paths (see TODOAI_CLI_DIR / EDGE_DIR below)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
WHEELS_DIR="$PROJECT_DIR/todoforai_tbench/wheels"

# Source package directories (relative to the monorepo root)
MONOREPO_DIR="$(cd "$PROJECT_DIR/../.." && pwd)"
TODOAI_CLI_DIR="${TODOAI_CLI_DIR:-$MONOREPO_DIR/todoai-cli}"
EDGE_DIR="${EDGE_DIR:-$MONOREPO_DIR/edge}"

echo "=== Rebuilding wheels ==="
echo "  todoai-cli:  $TODOAI_CLI_DIR"
echo "  edge:        $EDGE_DIR"
echo "  output:      $WHEELS_DIR"
echo ""

# Ensure output dir exists and is clean
mkdir -p "$WHEELS_DIR"
rm -f "$WHEELS_DIR"/*.whl

# Build todoai-cli
if [ -d "$TODOAI_CLI_DIR" ]; then
  echo "Building todoai-cli wheel..."
  python3 -m build --wheel --outdir "$WHEELS_DIR" "$TODOAI_CLI_DIR" 2>&1 | tail -1
else
  echo "WARNING: $TODOAI_CLI_DIR not found, skipping todoai-cli"
fi

# Build todoforai-edge-cli
if [ -d "$EDGE_DIR" ]; then
  echo "Building todoforai-edge-cli wheel..."
  python3 -m build --wheel --outdir "$WHEELS_DIR" "$EDGE_DIR" 2>&1 | tail -1
else
  echo "WARNING: $EDGE_DIR not found, skipping edge"
fi

echo ""
echo "=== Wheels built ==="
ls -lh "$WHEELS_DIR"/*.whl 2>/dev/null || echo "No wheels found!"
