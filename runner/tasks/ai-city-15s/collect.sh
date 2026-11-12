#!/usr/bin/env bash
# idle-camera recording (the scene animates itself; no scrolling)
REC_SCRIPT=idle exec "$(dirname "$0")/../web-animated/collect.sh" "$@"
