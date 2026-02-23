#!/bin/bash
set -e

echo "=== Installing TODOforAI for Terminal-Bench ==="

apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv

python3 -m venv /opt/todoforai-venv
/opt/todoforai-venv/bin/pip install -q --upgrade pip

# Always install todoai-cli from PyPI first (provides the CLI binary)
/opt/todoforai-venv/bin/pip install -q todoai-cli

# Upgrade edge with local wheel if available (fixes compatibility issues)
if ls /installed-agent/*.whl 1>/dev/null 2>&1; then
  echo "Upgrading edge from local wheel(s)..."
  /opt/todoforai-venv/bin/pip install -q --force-reinstall --no-deps /installed-agent/*.whl
fi

# pip may install the binary as todoai-cli or todoai_cli depending on version
if [ -f /opt/todoforai-venv/bin/todoai-cli ]; then
  ln -sf /opt/todoforai-venv/bin/todoai-cli /usr/local/bin/todoai-cli
else
  ln -sf /opt/todoforai-venv/bin/todoai_cli /usr/local/bin/todoai-cli
fi

echo "=== TODOforAI installation complete ==="
