#!/usr/bin/env bash
# One-command Terminal-Bench run, same shape as https://www.tbench.ai/run:
#
#   ./run.sh -m anthropic:anthropic/claude-opus-5.5                       # our agent, all tasks
#   ./run.sh -a claude-code -m anthropic/claude-opus-5-5 -e high          # reference agent
#   ./run.sh -m ... -d terminal-bench/terminal-bench@4.0.0 -t tasks_tb4_20.txt -n 4
#
#   -a  todoforai (default) | claude-code
#   -m  model (required; no default -- a silent default once ran the wrong model)
#   -d  dataset              (default terminal-bench/terminal-bench-2-1)
#   -t  task-list file       (one task name per line; default: whole dataset)
#   -i  single task          (repeatable; overrides -t)
#   -n  concurrency          (default 4, max 4: 4 x 8 GB task RAM fits the WSL host)
#   -k  attempts per task    (default 1)
#   -e  effort for claude-code (low|medium|high|xhigh|max). todoforai takes its
#       effort from the `app` agent's thinkingLevel, not from this flag.
#
# claude-code auth: CLAUDE_FORCE_OAUTH=1 + CLAUDE_CODE_OAUTH_TOKEN in
# $CLAUDE_ENV_FILE (default ~/claude-oauth.env, from `claude setup-token`).
# One harbor call for the whole list (wall time = slowest task, not sum of batches).
# Results: jobs/<agent>-<model>-<effort>__<timestamp>; `harbor view jobs`.
set -euo pipefail
cd "$(dirname "$0")"

AGENT=todoforai MODEL= DATASET=terminal-bench/terminal-bench-2-1 TASKS_FILE= CONC=4 K=1 EFFORT=
TASKS=()
while getopts "a:m:d:t:i:n:k:e:h" o; do
  case $o in
    a) AGENT=$OPTARG ;; m) MODEL=$OPTARG ;; d) DATASET=$OPTARG ;; t) TASKS_FILE=$OPTARG ;;
    i) TASKS+=("$OPTARG") ;; n) CONC=$OPTARG ;; k) K=$OPTARG ;; e) EFFORT=$OPTARG ;;
    *) sed -n '2,20p' "$0"; exit 2 ;;
  esac
done
[ -n "$MODEL" ] || { echo "-m <model> is required" >&2; exit 2; }
[ "$CONC" -le 4 ] || { echo "-n $CONC > 4: the WSL host swaps/crashes above 4 (LESSONS.md)" >&2; exit 2; }

HARBOR="${HARBOR_BIN:-$HOME/tbench-venv/bin/harbor}"
[ -x "$HARBOR" ] || HARBOR="$PWD/.venv/bin/harbor"
NS="${DATASET%%/*}"   # task namespace, e.g. terminal-bench

ARGS=(-d "$DATASET" -m "$MODEL" -n "$CONC" -k "$K" --yes -o jobs
      --max-retries 2 --retry-include ApiError --retry-include NetworkConnectionError)
case $AGENT in
  todoforai)
    [ -z "$EFFORT" ] || echo "note: -e ignored for todoforai (effort = app agent thinkingLevel)" >&2
    EFFORT=app
    "$(dirname "$HARBOR")/python" -c 'from todoforai_tbench.harbor_agent import preflight; preflight()'
    ARGS+=(--agent-import-path todoforai_tbench:TODOforAIHarborAgent) ;;
  claude-code)
    ENV_FILE="${CLAUDE_ENV_FILE:-$HOME/claude-oauth.env}"
    [ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE (CLAUDE_FORCE_OAUTH=1, CLAUDE_CODE_OAUTH_TOKEN=...)" >&2; exit 2; }
    ARGS+=(-a claude-code --env-file "$ENV_FILE")
    [ -z "$EFFORT" ] || ARGS+=(--ak "reasoning_effort=$EFFORT") ;;
  *) echo "-a must be todoforai or claude-code" >&2; exit 2 ;;
esac

if [ ${#TASKS[@]} -eq 0 ] && [ -n "$TASKS_FILE" ]; then
  mapfile -t TASKS < <(grep -v '^\s*$' "$TASKS_FILE" | tr -d '\r')
fi
for t in "${TASKS[@]}"; do ARGS+=(-i "$NS/$t"); done

JOB="${AGENT}-${MODEL##*/}-${EFFORT:-default}__$(date +%Y-%m-%d__%H-%M-%S)"
ARGS+=(--job-name "$JOB")
NT=${#TASKS[@]}; [ "$NT" -gt 0 ] || NT=all
echo "$(date '+%F %T') $AGENT $MODEL effort=${EFFORT:-default} $DATASET tasks=$NT n=$CONC k=$K -> jobs/$JOB"

# Leaked compose networks exhaust docker's address pools and fail later trials.
docker network prune -f >/dev/null 2>&1 || true
exec "$HARBOR" run "${ARGS[@]}"
