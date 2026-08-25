#!/bin/bash
# Dump the timeout-relevant config of two trials side by side, plus where each
# run kept its agent logs (the layout changed between harbor versions).
# Usage: bash cfg_diff.sh <trial-A> <trial-B>
set -u
cd "$(dirname "$0")/../jobs" || exit 1

show() {
  local t="$1"
  echo "════ $t"
  [ -d "$t" ] || { echo "  (missing)"; return; }
  echo "-- files in trial root:"
  ls "$t" | sed 's/^/     /'
  for cfg in "$t/config.json" "${t%%/*}/config.json"; do
    [ -f "$cfg" ] || continue
    echo "-- $cfg (timeout keys):"
    python3 - "$cfg" <<'PY' | sed 's/^/     /'
import json, sys
def walk(o, p=""):
    if isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, (dict, list)): walk(v, f"{p}.{k}")
            elif "timeout" in k.lower(): print(f"{p}.{k} = {v}")
    elif isinstance(o, list):
        for i, v in enumerate(o[:3]): walk(v, f"{p}[{i}]")
walk(json.load(open(sys.argv[1])))
PY
  done
  echo
}
for t in "$@"; do show "$t"; done
