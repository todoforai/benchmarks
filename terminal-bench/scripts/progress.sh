#!/bin/bash
# Live status of a batched sweep: per-batch rewards, totals, and how many trials
# were hit by a backend restart (those say nothing about agent capability).
# Usage: bash scripts/progress.sh [job-prefix]
set -u
PREFIX="${1:-tb21-gpt-5.6-sol-xhigh-ultra}"
cd "$(dirname "$0")/../jobs" || exit 1

pass=0; fail=0; hit=0; pass_clean=0; done_clean=0
for b in "$PREFIX"__batch*/ ; do
  [ -d "$b" ] || continue
  line=""
  for d in "$b"*/ ; do
    [ -f "$d/verifier/reward.txt" ] || continue
    r=$(cat "$d/verifier/reward.txt" 2>/dev/null)
    # A trial whose edge saw "Server restarting" lost its backend mid-run.
    [ "$r" = "1" ] && pass=$((pass+1)) || fail=$((fail+1))
    if grep -q "Server restarting" "$d/agent/edge.txt" 2>/dev/null; then
      line+="R"; hit=$((hit+1))
    else
      line+="$r"; done_clean=$((done_clean+1)); [ "$r" = "1" ] && pass_clean=$((pass_clean+1))
    fi
  done
  printf '%s %s\n' "$(echo "$b" | grep -o 'batch[0-9]*')" "$line"
done

done_n=$((pass+fail))
echo "---"
echo "done=$done_n/89  pass=$pass  fail=$fail  restart-hit=$hit  (R = backend restarted mid-trial)"
[ $done_n -gt 0 ] && echo "raw pass-rate=$((pass*100/done_n))%"
[ $done_clean -gt 0 ] && echo "clean pass-rate=$((pass_clean*100/done_clean))%  ($pass_clean/$done_clean, restart-hit trials excluded)"
echo "running containers=$(docker ps -q 2>/dev/null | wc -l)"
