#!/usr/bin/env bash
# Artifact timelapse: watch a run's work/ and keep every saved version of the
# outputs (svg/html/png/jpg/blend/py) as timeline/<elapsed-s>_<name>. Started by
# run.sh next to the agent; killed when the agent exits. No display needed.
#   ./record.sh <rundir>          (rundir has work/)
set -euo pipefail
d=$1; W="$d/work"; T="$d/timeline"; mkdir -p "$T"; t0=$(date +%s); n=0
inotifywait -m -r -q -e close_write -e moved_to --format '%w%f' "$W" 2>/dev/null |
while read -r f; do
  case "$f" in *.svg|*.html|*.png|*.jpg|*.blend|*.py) ;; *) continue;; esac
  # Never follow links: a model could point leak.svg at a host file (this runs outside the sandbox).
  [ -f "$f" ] && [ ! -L "$f" ] || continue
  n=$((n+1)); rel=${f#"$W"/}
  cp -P --no-preserve=all "$f" "$T/$(printf '%05d_%04d' $(( $(date +%s) - t0 )) $n)_${rel//\//__}" 2>/dev/null || true
done
