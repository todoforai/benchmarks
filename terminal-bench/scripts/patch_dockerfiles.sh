#!/bin/bash
# Patches cached terminal-bench Dockerfiles to pre-install the todoforai edge.
# This adds ~30s to the Docker build (one-time) but saves ~35s per task at runtime.
#
# Usage:
#   ./scripts/patch_dockerfiles.sh                    # patch terminal-bench-core 0.1.1
#   ./scripts/patch_dockerfiles.sh <dataset> <version>
#
# After patching, run:
#   tb run --no-rebuild ...   (images already have the edge baked in)
#
# To undo:
#   ./scripts/patch_dockerfiles.sh --undo

set -euo pipefail

DATASET="${1:-terminal-bench-core}"
VERSION="${2:-0.1.1}"
CACHE_DIR="$HOME/.cache/terminal-bench/$DATASET/$VERSION"

PATCH_MARKER="# --- todoforai-edge pre-install ---"

EDGE_INSTALL_LINES="
$PATCH_MARKER
RUN apt-get update -qq && apt-get install -y -qq python3 python3-pip python3-venv 2>/dev/null; \\
    python3 -m venv /opt/todoforai-venv && \\
    /opt/todoforai-venv/bin/pip install -q --upgrade pip && \\
    /opt/todoforai-venv/bin/pip install -q todoforai-edge-cli || true
$PATCH_MARKER"

if [ "$DATASET" = "--undo" ]; then
    echo "Undoing patches..."
    DATASET="${VERSION:-terminal-bench-core}"
    VERSION="${3:-0.1.1}"
    CACHE_DIR="$HOME/.cache/terminal-bench/$DATASET/$VERSION"

    count=0
    for dockerfile in "$CACHE_DIR"/*/Dockerfile; do
        if grep -q "$PATCH_MARKER" "$dockerfile" 2>/dev/null; then
            sed -i "/$PATCH_MARKER/,/$PATCH_MARKER/d" "$dockerfile"
            count=$((count + 1))
        fi
    done
    echo "Unpatched $count Dockerfiles"
    exit 0
fi

if [ ! -d "$CACHE_DIR" ]; then
    echo "Cache dir not found: $CACHE_DIR"
    echo "Run a benchmark first so tasks get downloaded, then patch."
    exit 1
fi

patched=0
skipped=0

for dockerfile in "$CACHE_DIR"/*/Dockerfile; do
    task_name=$(basename "$(dirname "$dockerfile")")

    # Skip if already patched
    if grep -q "$PATCH_MARKER" "$dockerfile" 2>/dev/null; then
        skipped=$((skipped + 1))
        continue
    fi

    # Append edge install lines at the end of the Dockerfile
    echo "$EDGE_INSTALL_LINES" >> "$dockerfile"
    patched=$((patched + 1))
done

echo "Patched $patched Dockerfiles ($skipped already patched)"
echo ""
echo "Now pre-build all images:"
echo "  for task in $CACHE_DIR/*/; do"
echo "    tb tasks build -p \"\$task\" 2>/dev/null &"
echo "  done"
echo "  wait"
echo ""
echo "Then run benchmarks with --no-rebuild to use the cached images."
