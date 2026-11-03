#!/usr/bin/env bash
# Pass/fail/running per trial for one or more harbor job dirs.
for j in "$@"; do
  for t in "$j"/*/; do
    [ -f "$t/config.json" ] || continue
    r=$(cat "$t/verifier/reward.txt" 2>/dev/null)
    e=$(jq -r '.exception_info.exception_type // empty' "$t/result.json" 2>/dev/null)
    if [ -n "$r" ]; then s="reward=$r"; elif [ -f "$t/result.json" ]; then s="ERR ${e:-no-reward}"; else s=running; fi
    printf "%-38s %s\n" "$(basename "$t" | sed 's/__.*//')" "$s"
  done
done | sort | tee /dev/stderr | awk '{n++} /reward=1/{p++} /running/{r++} END{printf "\n%d trials: %d pass, %d running\n", n, p, r}'
