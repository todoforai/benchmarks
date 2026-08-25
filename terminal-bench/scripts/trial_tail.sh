#!/bin/bash
# Show the timeline of a single trial's agent log: how far it got, whether it
# was looping, and what the last tool calls were before the cut-off.
# Usage: bash trial_tail.sh <trial-dir> [n]
set -u
D="${1:?usage: trial_tail.sh <trial-dir> [n]}"
N="${2:-40}"
LOG="$D/agent/todoforai-cli.txt"

echo "== $D"
echo "-- reward: $(cat "$D/verifier/reward.txt" 2>/dev/null || echo -)"
echo "-- log lines: $(wc -l < "$LOG" 2>/dev/null)"
echo
echo "== tool call histogram (cmd= prefix, top 15)"
grep -oE 'cmd=[^ ]*' "$LOG" 2>/dev/null | sed 's/^cmd=//' | cut -c1-40 | sort | uniq -c | sort -rn | head -15
echo
echo "== last $N non-empty lines"
grep -v '^\s*$' "$LOG" 2>/dev/null | tail -"$N" | cut -c1-160
