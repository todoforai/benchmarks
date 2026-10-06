#!/usr/bin/env bash
# Fetch the pinned three.js used by threejs-* tasks (same version BridgeBench serves: three@0.182.0).
# Vendored (gitignored) so every model gets the identical library and no CDN is needed.
set -euo pipefail; cd "$(dirname "$0")"
V=${1:-0.182.0}; D=vendor/three@$V; [ -f "$D/three.module.min.js" ] && { echo "have $D"; exit 0; }
mkdir -p "$D" tmp && curl -sL "https://registry.npmjs.org/three/-/three-$V.tgz" | tar xz -C tmp
mv tmp/package/build/three.module.min.js tmp/package/build/three.core.min.js "$D/" && mv tmp/package/examples/jsm "$D/addons" && rm -rf tmp && echo "fetched $D"
