#!/usr/bin/env bash
# report expected outputs
d=$1; for f in scene.blend render.png; do [ -s "$d/work/out/$f" ] && echo "   ok $f" || echo "   MISSING $f"; done
