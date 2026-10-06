#!/usr/bin/env bash
exec "$(dirname "$0")/../../svg2png.sh" "$1" device.svg
