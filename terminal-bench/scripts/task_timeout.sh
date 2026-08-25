#!/bin/bash
# Find a task's own definition in the harbor task cache and print its declared
# timeouts (tasks carry their own max_agent_timeout_sec; the job config does not).
# Usage: bash task_timeout.sh <task-name>
set -u
T="${1:?usage: task_timeout.sh <task-name>}"
CACHE="$HOME/.cache/harbor/tasks/packages/terminal-bench"

DEF=$(find "$CACHE" -maxdepth 4 -type d -name "$T" 2>/dev/null | head -1)
echo "task dir: ${DEF:-<not found>}"
[ -n "$DEF" ] || exit 1

find "$DEF" -maxdepth 1 -type f | sed 's/^/  /'
echo "-- declared timeouts:"
grep -rhnE '[a-z_]*timeout[a-z_]*' "$DEF"/*.yaml "$DEF"/*.toml "$DEF"/*.json 2>/dev/null | sed 's/^/  /'
