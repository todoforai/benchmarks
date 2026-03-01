#!/bin/bash
set -e

echo "=== Installing TODOforAI for Terminal-Bench ==="

apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv libfuse-dev

python3 -m venv /opt/todoforai-venv
/opt/todoforai-venv/bin/pip install -q --upgrade pip

# Install from local wheels if available, otherwise from PyPI
if ls /installed-agent/wheels/*.whl 1>/dev/null 2>&1; then
  echo "Installing from local wheels..."
  /opt/todoforai-venv/bin/pip install -q /installed-agent/wheels/*.whl
else
  echo "Installing from PyPI..."
  /opt/todoforai-venv/bin/pip install -q todoai-cli
fi

# pip may install the binary as todoai-cli or todoai_cli depending on version
if [ -f /opt/todoforai-venv/bin/todoai-cli ]; then
  ln -sf /opt/todoforai-venv/bin/todoai-cli /usr/local/bin/todoai-cli
else
  ln -sf /opt/todoforai-venv/bin/todoai_cli /usr/local/bin/todoai-cli
fi

echo "=== TODOforAI installation complete ==="
