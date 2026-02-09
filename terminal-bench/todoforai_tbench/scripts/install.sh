#!/bin/bash
set -e

echo "=== Installing TODOforAI for Terminal-Bench ==="

apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv

python3 -m venv /opt/todoforai-venv
/opt/todoforai-venv/bin/pip install -q --upgrade pip
/opt/todoforai-venv/bin/pip install -q todoai-cli

ln -sf /opt/todoforai-venv/bin/todoai-cli /usr/local/bin/todoai-cli

echo "=== TODOforAI installation complete ==="
