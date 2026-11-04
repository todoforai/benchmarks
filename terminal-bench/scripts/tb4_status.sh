#!/usr/bin/env bash
# reward / error / running + cost per trial for harbor job dirs (reward from result.json).
for j in "$@"; do
  for t in "$j"/*/; do
    [ -f "$t/config.json" ] || continue
    n=$(basename "$t" | sed 's/__.*//')
    if [ -f "$t/result.json" ]; then
      jq -r --arg n "$n" '[$n, (.verifier_result.rewards.reward // ("ERR " + (.exception_info.exception_type // "no-reward")) | tostring), ((.agent_result.cost_usd // 0)*100|round/100|tostring)] | @tsv' "$t/result.json"
    else printf "%s\trunning\t-\n" "$n"; fi
  done
done | sort | tee /dev/stderr | awk -F'\t' '{n++; c+=$3} $2+0==1{p++} $2=="running"{r++} END{printf "\n%d trials: %d pass, %d fail/err, %d running, $%.2f\n", n, p, n-p-r, r, c}'
