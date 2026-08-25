#!/bin/bash
# Diagnose why trials failed: agent timeout vs wrong answer vs infra.
# Usage: bash diagnose_job.sh <job-dir>
set -u
JOB="${1:?usage: diagnose_job.sh <job-dir>}"
cd "$JOB" || exit 1

for d in */; do
  d="${d%/}"
  [ -d "$d/agent" ] || continue
  reward=$(cat "$d/verifier/reward.txt" 2>/dev/null || echo "-")
  kind="ok"
  if [ -f "$d/exception.txt" ]; then
    kind=$(grep -oE '[A-Za-z]+Error' "$d/exception.txt" | tail -1)
  fi
  cli_lines=$(wc -l < "$d/agent/todoforai-cli.txt" 2>/dev/null || echo 0)
  # Last thing the agent said before it was cut off.
  last=$(grep -v '^\s*$' "$d/agent/todoforai-cli.txt" 2>/dev/null | tail -1 | cut -c1-90)
  printf '%-42s reward=%-3s %-22s cli_lines=%-6s %s\n' "$d" "$reward" "$kind" "$cli_lines" "$last"
done
