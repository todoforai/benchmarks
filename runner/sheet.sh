#!/usr/bin/env bash
# Contact sheet + results table for one run: every model's shot side by side, labelled.
#   ./sheet.sh runs/<task>/<ts>  [shot-name=shot.png]   → <run>/sheet.png + <run>/RESULTS.md
set -euo pipefail; run=$(readlink -f "$1"); shot=${2:-shot.png}; cd "$run"
rows=(); files=()
for d in */; do d=${d%/}; [ -f "$d/meta.json" ] || continue
  m=$(jq -r '"\(.model|sub(".*/";""))\t\(if .qualified == null then "?" else .qualified end)\t\(.cost_usd // 0 | . * 100 | round / 100)\t\(.wall_s)\t\(.turns // "")\t\(.reason // "")"' "$d/meta.json")
  rows+=("$m"); f="$d/work/$shot"; [ -s "$f" ] || f=""
  [ -n "$f" ] && { ffmpeg -y -loglevel error -i "$f" -vf "scale=640:-1,drawtext=text='${d//_/ }':x=10:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6" "/tmp/sheet_$d.png"; files+=("/tmp/sheet_$d.png"); }
done
n=${#files[@]}; [ $n -eq 1 ] && cp "${files[0]}" sheet.png; [ $n -gt 1 ] && { cols=$(( n>3 ? 3 : n )); rows_=$(( (n+cols-1)/cols ))
  ffmpeg -y -loglevel error $(printf -- '-i %s ' "${files[@]}") -filter_complex "$(for i in $(seq 0 $((n-1))); do printf '[%d:v]scale=640:400:force_original_aspect_ratio=decrease,pad=640:400:-1:-1:black[v%d];' $i $i; done)$(for i in $(seq 0 $((n-1))); do printf '[v%d]' $i; done)xstack=inputs=$n:layout=$(for i in $(seq 0 $((n-1))); do printf '%d_%d|' $(( (i%cols)*640 )) $(( (i/cols)*400 )); done | sed 's/|$//'):fill=black" sheet.png; rm -f "${files[@]}"; }
{ echo "# $(basename "$(dirname "$run")") — $(basename "$run")"; echo; echo "![sheet](sheet.png)"; echo
  echo "| model | qualified | cost \$ | wall s | turns | note | rank |"; echo "|---|---|---:|---:|---:|---|---|"
  printf '%s\n' "${rows[@]}" | awk -F'\t' '{printf "| %s | %s | %s | %s | %s | %s |  |\n",$1,$2,$3,$4,$5,$6}'; } > RESULTS.md
echo "   $run/sheet.png + RESULTS.md ($n shots)"
