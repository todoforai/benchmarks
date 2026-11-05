#!/usr/bin/env bash
cd /mnt/c/repo/todoforai/benchmarks/terminal-bench
J=${1:-jobs/todoforai-gpt-6.1-sol-app-sol__2026-11-05__14-55-27}
for d in "$J"/*/; do
  [ -f "$d/result.json" ] || continue
  r=$(cat "$d/verifier/reward.txt" 2>/dev/null || echo -)
  e=$(grep -o '"exception_type": *"[^"]*"' "$d/result.json" | head -1 | sed 's/.*: *//')
  R=$(grep -q "Server restarting" "$d/agent/edge.txt" 2>/dev/null && echo RESTART)
  echo "$(basename "$d") $r $e $R"
done | sort -k2
echo "running: $(docker ps --format '{{.Names}}' | sed 's/__.*//' | paste -sd' ')"
