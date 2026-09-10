#!/usr/bin/env bash
# Rasterize pelican.svg -> pelican.png at the SVG's own viewBox size (a fixed
# window silently crops). rsvg-convert if present, else headless Chrome
# (on WSL that's Windows Chrome under /mnt/c).
# Usage: ./render.sh <file.svg> [more.svg ...]
set -euo pipefail
CHROME=$(command -v google-chrome || command -v chromium || command -v chromium-browser || echo "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe")
for svg in "$@"; do
  svg=$(readlink -f "$svg"); png="${svg%.svg}.png"
  dims=$(head -c 600 "$svg" | tr '\n' ' ' | sed -n 's/.*viewBox="[0-9.]* [0-9.]* \([0-9.]*\) \([0-9.]*\)".*/\1 \2/p' | head -1)
  w=${dims% *}; h=${dims#* }; w=${w:-1000}; h=${h:-700}; w=${w%.*}; h=${h%.*}
  if command -v rsvg-convert >/dev/null; then
    rsvg-convert -w "$w" "$svg" -o "$png"
  elif [ -x "$CHROME" ]; then
    url="file://$svg"; out="$png"
    case "$CHROME" in /mnt/c/*) url="file:///$(wslpath -w "$svg" | tr '\\' /)"; out=$(wslpath -w "$png");; esac
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="$w,$h" \
      --screenshot="$out" "$url" >/dev/null 2>&1
  else
    echo "no rasterizer (rsvg-convert or Chrome)" >&2; exit 1
  fi
  echo "   $png (${w}x${h})"
done
