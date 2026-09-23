#!/usr/bin/env bash
# report expected outputs
d=$1; for f in scene.blend danger.mp4 frame_100.png; do [ -s "$d/work/out/$f" ] && echo "   ok $f" || echo "   MISSING $f"; done
