#!/bin/bash
set -e

echo "=== Installing TODOforAI for Terminal-Bench ==="

# Install bun
apt-get update -qq
apt-get install -y -qq curl unzip
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> /etc/environment

# Install todoai CLI (Bun) and todoforai-edge
# Use local dist if available (from rebuild_wheels.sh), otherwise npm
if [ -f /installed-agent/dist/todoai.js ]; then
  echo "Installing todoai from local dist..."
  mkdir -p /usr/local/lib/todoai
  cp /installed-agent/dist/todoai.js /usr/local/lib/todoai/todoai.js
  chmod +x /usr/local/lib/todoai/todoai.js
  printf '#!/bin/bash\nexec bun /usr/local/lib/todoai/todoai.js "$@"\n' > /usr/local/bin/todoai
  chmod +x /usr/local/bin/todoai
else
  echo "Installing @todoforai/cli from npm..."
  bun add -g @todoforai/cli
fi

# Install todoforai-edge (node-compatible, runs with node or bun)
if [ -f /installed-agent/dist/todoforai-edge.js ]; then
  echo "Installing todoforai-edge from local dist..."
  mkdir -p /usr/local/lib/todoforai-edge
  cp /installed-agent/dist/todoforai-edge.js /usr/local/lib/todoforai-edge/index.js
  printf '#!/bin/bash\nexec bun /usr/local/lib/todoforai-edge/index.js "$@"\n' > /usr/local/bin/todoforai-edge
  chmod +x /usr/local/bin/todoforai-edge
else
  echo "Installing @todoforai/edge from npm..."
  bun add -g @todoforai/edge
fi

echo "=== TODOforAI installation complete ==="
todoai --help 2>&1 | head -3 || true
