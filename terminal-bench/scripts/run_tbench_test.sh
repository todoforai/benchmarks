#!/bin/bash
# Run a single terminal-bench task for testing

set -e

N_TASKS=${1:-1}

echo "Installing todoforai_tbench package..."
pip install -e /home/hm/repo/todoforai/benchmarks/terminal-bench --quiet

echo "Running terminal-bench with $N_TASKS task(s)..."
/home/hm/.local/bin/tb run \
    --dataset terminal-bench-core==0.1.1 \
    --agent-import-path "todoforai_tbench:TODOforAIAgent" \
    --n-tasks "$N_TASKS" \
    --n-concurrent 1 \
    --livestream \
    --log-level info

echo "Done!"
