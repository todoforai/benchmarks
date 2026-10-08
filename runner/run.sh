#!/usr/bin/env bash
# Run one bench task across models, each in its own throwaway container.
#   ./run.sh <task|bench/task> [-p N] [model ...]      default models: $DEFAULT_MODELS
# Isolation (sandbox.sh / bwrap): /work = empty dir + tasks/<task>/assets copy is
# the only writable path, private /tmp+HOME, no /home, one mayfly session per model.
# Output: runs/<task>/<ts>/<model>/{work/,timeline/,timelapse.mp4,agent.log,meta.json}
# meta.json: wall_s, exit + cost_usd, turns (metrics.sh). Solution size: `wc -c work/<file>`.
set -euo pipefail
cd "$(dirname "$0")"
TASK=${1:?task}; shift
PAR=1; [ "${1:-}" = "-p" ] && { PAR=$2; shift 2; }
[[ $PAR =~ ^[1-9][0-9]*$ ]] || { echo "-p needs a positive int" >&2; exit 2; }
: "${TODOFORAI_API_KEYS_FILE:=$PWD/../terminal-bench/dev_api_keys.txt}"
: "${TODOFORAI_API_URL:=https://api.todofor.ai}"
: "${AGENT:=arena}" "${TIMEOUT:=1800}"
DEFAULT_MODELS="openai:openai/gpt-6-sol anthropic:anthropic/claude-opus-5 anthropic:anthropic/claude-sonnet-5"
MODELS=("$@"); [ ${#MODELS[@]} -gt 0 ] || read -ra MODELS <<<"$DEFAULT_MODELS"
# Task = runner/tasks/<name> or a category dir: ../<bench>/tasks/<name> (e.g. 3d-bench/lava-lamp).
case $TASK in */*) TD="../${TASK%/*}/tasks/${TASK##*/}";; *) TD="tasks/$TASK";; esac
# A/B variants: PROMPT_FILE overrides the prompt, RUNS keeps the variant out of runs/ (publish.sh reads runs/ only).
: "${PROMPT_FILE:=$TD/prompt.txt}" "${RUNS:=runs}"
[ -f "$PROMPT_FILE" ] || { echo "no $PROMPT_FILE" >&2; exit 1; }
SLUG=${TASK//\//_}
[ -f "$TD/task.env" ] && . "$TD/task.env"          # TIMEOUT=...
# --isolated = one todo-scoped mayfly bridge per run, so one account can run them all in parallel.
# Several keys in the file are just spread round-robin.
mapfile -t KEYS < <(grep -v '^#' "$TODOFORAI_API_KEYS_FILE" | awk 'NF && !seen[$1]++{print $1}')
[ ${#KEYS[@]} -ge 1 ] || { echo "no keys in $TODOFORAI_API_KEYS_FILE" >&2; exit 1; }
./sandbox.sh . -- true 2>/dev/null || { echo "bwrap blocked — see README (apparmor profile)" >&2; exit 1; }

RUN="$RUNS/$SLUG/$(date +%Y-%m-%d__%H-%M-%S)_$$"; mkdir -p "$RUN"; cp "$PROMPT_FILE" "$RUN/prompt.txt"
one() {  # $1 model  $2 key
  local M=$1 KEY=$2 slug=${1#*:} d rc; slug=${slug//\//_}; slug=${slug//[()]/_}; slug=${slug%_}; d="$RUN/$slug"; mkdir -p "$d/work"
  [ -d "$TD/assets" ] && cp -r "$TD/assets/." "$d/work/"
  local t0=$(date +%s)
  echo "== $M -> $d"
  setsid ./record.sh "$d" & local rec=$!               # artifact timelapse (own pgroup → clean kill)
  # Key via env only (never argv); sandbox.sh --clearenv drops everything else
  # (incl. the calling shell's TODOFORAI_PROJECT_ID/TODO_ID → 403 otherwise).
  # Watchdog (stopgap until the CLI reconciles status itself): the CLI sometimes misses the end of the
  # stream and hangs until the timeout although the todo finished server-side. Two consecutive terminal
  # observations (DONE/READY) with an idle log → kill this model's sandbox. Errors just retry.
  ( set +euo pipefail; abs=$(readlink -f "$d/work" | sed 's/[][\.*^$()+?{}|]/\\&/g'); hits=0
    while sleep 30; do
      id=$(grep -oEm1 'todofor\.ai/t/[0-9a-f-]{36}' "$d/agent.log" 2>/dev/null | cut -d/ -f3); [ -n "$id" ] || continue
      idle=$(( $(date +%s) - $(stat -c %Y "$d/agent.log" 2>/dev/null || date +%s) ))
      st=$(curl -s -m 20 -H "x-api-key: $KEY" "$TODOFORAI_API_URL/api/v1/todos/$id" | jq -r '.status // empty' 2>/dev/null)
      case $st in DONE|READY) [ "$idle" -ge 120 ] && hits=$((hits+1));; *) hits=0;; esac
      [ "$hits" -ge 2 ] || continue
      pkill -f "^bwrap .*--bind $abs /work" && touch "$d/.server_done"; exit
    done ) & local wd=$!
  set +e
  # Model/agent via env too: ids like "…/claude-opus-5.5(high)" break shell quoting.
  TODOFORAI_API_TOKEN="$KEY" TFA_PROMPT="$(cat "$PROMPT_FILE")" TFA_MODEL="$M" TFA_AGENT="$AGENT" \
    ./sandbox.sh "$d/work" -- bash -c 'printf "%s" "$TFA_PROMPT" | timeout '"$TIMEOUT"' todoforai-cli --isolated --non-interactive --allow-all --path /work --agent "$TFA_AGENT" --model "$TFA_MODEL"' \
    2>&1 | while IFS= read -r l; do printf '%(%H:%M:%S)T %s\n' -1 "$l"; done >"$d/agent.log"; rc=${PIPESTATUS[0]}
  set -e; kill "$wd" 2>/dev/null || true; wait "$wd" 2>/dev/null || true
  kill -- -"$rec" 2>/dev/null || true; wait "$rec" 2>/dev/null || true
  [ -f "$d/.server_done" ] && echo "   (stream dropped; todo finished server-side → sandbox stopped, collecting)"
  jq -n --arg m "$M" --arg task "$TASK" --arg agent "$AGENT" --argjson rc "$rc" --arg prompt_sha "$(sha256sum "$PROMPT_FILE" | cut -c1-12)" --argjson s "$(( $(date +%s) - t0 ))" --argjson to "$TIMEOUT" \
    '{model:$m,task:$task,agent:$agent,prompt_sha:$prompt_sha,exit:$rc,wall_s:$s,timeout_s:$to}' >"$d/meta.json"
  [ -f "$d/.server_done" ] && jq '.watchdog_killed=true | .badges=((.badges//[])+["stream dropped, output collected"])' "$d/meta.json" >"$d/m.tmp" && mv "$d/m.tmp" "$d/meta.json"
  ./metrics.sh "$d" "$KEY" || true                     # + cost_usd, turns (from the todo)
  [ -x "$TD/collect.sh" ] && "$TD/collect.sh" "$d" || true
  ./timelapse.sh "$d" || true
  echo "   $slug exit=$rc $(( $(date +%s) - t0 ))s"
}
i=0
for M in "${MODELS[@]}"; do
  one "$M" "${KEYS[$((i % ${#KEYS[@]}))]}" & i=$((i+1))
  [ $(( i % PAR )) -eq 0 ] && wait
done; wait
echo "DONE $RUN"
