#!/usr/bin/env bash
# Run one arena task across models, each in its own throwaway container.
#   ./run.sh <task> [-p N] [model ...]      default models: $DEFAULT_MODELS
# Isolation (sandbox.sh / bwrap): /work = empty dir + tasks/<task>/assets copy is
# the only writable path, private /tmp+HOME, no /home, one mayfly session per model.
# Output: runs/<task>/<ts>/<model>/{work/,timeline/,timelapse.mp4,agent.log,meta.json}
# meta.json: wall_s, cost_usd (tokens x list price), turns, tool_calls, solution_chars.
set -euo pipefail
cd "$(dirname "$0")"
TASK=${1:?task}; shift
PAR=1; [ "${1:-}" = "-p" ] && { PAR=$2; shift 2; }
[[ $PAR =~ ^[1-9][0-9]*$ ]] || { echo "-p needs a positive int" >&2; exit 2; }
: "${TODOFORAI_API_KEYS_FILE:=$PWD/../terminal-bench/dev_api_keys.txt}"
: "${TODOFORAI_API_URL:=https://api.todofor.ai}"
: "${AGENT:=app}" "${TIMEOUT:=1800}"
DEFAULT_MODELS="openai:openai/gpt-6-sol anthropic:anthropic/claude-opus-5 anthropic:anthropic/claude-sonnet-5"
MODELS=("$@"); [ ${#MODELS[@]} -gt 0 ] || read -ra MODELS <<<"$DEFAULT_MODELS"
TD="tasks/$TASK"; [ -f "$TD/prompt.txt" ] || { echo "no $TD/prompt.txt" >&2; exit 1; }
[ -f "$TD/task.env" ] && . "$TD/task.env"          # TIMEOUT=, SOLUTION=
set -f  # SOLUTION globs are expanded by metrics.mjs, not the shell
# One key per concurrent container (same rule as terminal-bench).
mapfile -t KEYS < <(grep -v '^#' "$TODOFORAI_API_KEYS_FILE" | awk 'NF && !seen[$1]++{print $1}')
[ ${#KEYS[@]} -ge "$PAR" ] || { echo "need $PAR keys, have ${#KEYS[@]}" >&2; exit 1; }
./sandbox.sh . -- true 2>/dev/null || { echo "bwrap blocked — see README (apparmor profile)" >&2; exit 1; }

RUN="runs/$TASK/$(date +%Y-%m-%d__%H-%M-%S)_$$"; mkdir -p "$RUN"; cp "$TD/prompt.txt" "$RUN/"
one() {  # $1 model  $2 key
  local M=$1 KEY=$2 slug=${1#*:} d rc; slug=${slug//\//_}; slug=${slug//[()]/_}; slug=${slug%_}; d="$RUN/$slug"; mkdir -p "$d/work"
  [ -d "$TD/assets" ] && cp -r "$TD/assets/." "$d/work/"
  local t0=$(date +%s)
  echo "== $M -> $d"
  setsid ./record.sh "$d" & local rec=$!               # artifact timelapse (own pgroup → clean kill)
  # Key via env only (never argv); sandbox.sh --clearenv drops everything else
  # (incl. the calling shell's TODOFORAI_PROJECT_ID/TODO_ID → 403 otherwise).
  set +e
  # Model/agent via env too: ids like "…/claude-opus-5.5(high)" break shell quoting.
  TODOFORAI_API_TOKEN="$KEY" TFA_PROMPT="$(cat "$TD/prompt.txt")" TFA_MODEL="$M" TFA_AGENT="$AGENT" \
    ./sandbox.sh "$d/work" -- bash -c 'printf "%s" "$TFA_PROMPT" | timeout '"$TIMEOUT"' todoforai-cli --isolated --non-interactive --allow-all --path /work --agent "$TFA_AGENT" --model "$TFA_MODEL"' \
    2>&1 | while IFS= read -r l; do printf '%(%H:%M:%S)T %s\n' -1 "$l"; done >"$d/agent.log"; rc=${PIPESTATUS[0]}
  set -e; kill -- -"$rec" 2>/dev/null || true; wait "$rec" 2>/dev/null || true
  jq -n --arg m "$M" --arg task "$TASK" --arg agent "$AGENT" --argjson rc "$rc" --argjson s "$(( $(date +%s) - t0 ))" \
    '{model:$m,task:$task,agent:$agent,exit:$rc,wall_s:$s}' >"$d/meta.json"
  node metrics.mjs "$d" ${SOLUTION:-} || true          # cost, turns, tool calls, solution chars
  [ -x "$TD/collect.sh" ] && "$TD/collect.sh" "$d" || true
  ./timelapse.sh "$d" || true
  echo "   $slug exit=$rc $(( $(date +%s) - t0 ))s"
}
i=0
for M in "${MODELS[@]}"; do
  one "$M" "${KEYS[$((i % PAR))]}" & i=$((i+1))
  [ $(( i % PAR )) -eq 0 ] && wait
done; wait
echo "DONE $RUN"
