#!/bin/bash
# Stop a benchmark run: harbor processes and every container. Deliberately does
# NOT delete anything -- an earlier version took a prefix and removed job dirs,
# which threw away a completed batch along with the interrupted one. Delete
# job dirs by hand, after looking at what is in them.
set -u

pkill -9 -f 'harbor run' 2>/dev/null
pkill -9 -f run_batches 2>/dev/null
sleep 2
docker ps -aq | xargs -r docker rm -f >/dev/null 2>&1

echo "harbor=$(pgrep -cf 'harbor run' || echo 0) containers=$(docker ps -aq | wc -l)"
