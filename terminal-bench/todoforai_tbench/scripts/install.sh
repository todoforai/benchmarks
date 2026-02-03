#!/bin/bash
# TODOforAI Installation Script for Terminal-Bench
#
# This script is executed inside the benchmark container to install
# the todoai-cli tool and its dependencies.
#
# Assumes: Debian/Ubuntu Linux environment

set -e

echo "=== Installing TODOforAI for Terminal-Bench ==="

# Update package lists
apt-get update -qq

# Install Python and pip if not present
if ! command -v python3 &> /dev/null; then
    echo "Installing Python..."
    apt-get install -y -qq python3 python3-pip python3-venv
fi

# Install Node.js (required for some tools)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    apt-get install -y -qq nodejs npm
fi

# Install git (needed for some operations)
if ! command -v git &> /dev/null; then
    apt-get install -y -qq git
fi

# Create virtual environment
echo "Setting up Python environment..."
python3 -m venv /opt/todoforai-venv
source /opt/todoforai-venv/bin/activate

# Upgrade pip
pip install --upgrade pip -q

# Install todoai-cli and todoforai-edge-cli
echo "Installing todoai-cli and todoforai-edge-cli..."
pip install todoai-cli todoforai-edge-cli
echo "Pip install completed with exit code: $?"
which todoai-cli && echo "todoai-cli found" || echo "todoai-cli NOT in PATH"
ls -la /opt/todoforai-venv/bin/todoai* 2>/dev/null || echo "No todoai binaries in venv"

# Verify installation
echo "Verifying installation..."
todoai-cli --version || echo "todoai-cli installed (version command may not exist)"

# Find the actual todoai-cli binary name
TODOAI_BIN=""
if [ -f /opt/todoforai-venv/bin/todoai-cli ]; then
    TODOAI_BIN="/opt/todoforai-venv/bin/todoai-cli"
elif [ -f /opt/todoforai-venv/bin/todoai_cli ]; then
    TODOAI_BIN="/opt/todoforai-venv/bin/todoai_cli"
fi
echo "Found todoai-cli at: $TODOAI_BIN"

# Create wrapper scripts that activate venv
cat > /usr/local/bin/todoai-cli-wrapper << EOF
#!/bin/bash
source /opt/todoforai-venv/bin/activate
exec $TODOAI_BIN "\$@"
EOF
chmod +x /usr/local/bin/todoai-cli-wrapper

cat > /usr/local/bin/todoforai-edge-cli-wrapper << 'EOF'
#!/bin/bash
source /opt/todoforai-venv/bin/activate
exec todoforai-edge-cli "$@"
EOF
chmod +x /usr/local/bin/todoforai-edge-cli-wrapper

# Create symlinks (force overwrite)
ln -sf /usr/local/bin/todoai-cli-wrapper /usr/local/bin/todoai-cli
ln -sf /usr/local/bin/todoforai-edge-cli-wrapper /usr/local/bin/todoforai-edge-cli

# Verify the wrappers work
echo "Verifying wrappers..."
/usr/local/bin/todoai-cli --help > /dev/null 2>&1 && echo "todoai-cli wrapper OK" || echo "todoai-cli wrapper FAILED"
/usr/local/bin/todoforai-edge-cli --help > /dev/null 2>&1 && echo "todoforai-edge-cli wrapper OK" || echo "todoforai-edge-cli wrapper FAILED"

# Create run script for executing tasks
cat > /usr/local/bin/todoai-run << 'RUNEOF'
#!/bin/bash
# Run edge and todoai-cli for a task
source /opt/todoforai-venv/bin/activate

# Fix Docker networking - get host IP
if [ -z "$TODOFORAI_API_URL" ]; then
    # Try to get host gateway IP
    HOST_IP=$(ip route | grep default | awk '{print $3}')
    export TODOFORAI_API_URL="http://${HOST_IP}:4000"
fi

echo "API URL: $TODOFORAI_API_URL"
echo "Starting edge..."
/opt/todoforai-venv/bin/todoforai-edge-cli --api-url "$TODOFORAI_API_URL" --api-key "$TODOFORAI_API_KEY" > /tmp/edge.log 2>&1 &
EDGE_PID=$!
echo "Edge PID: $EDGE_PID"
sleep 5
echo "Running todoai-cli..."
# Run todoai-cli with the task from stdin (no --timeout flag)
cat | /opt/todoforai-venv/bin/todoai_cli --api-url "$TODOFORAI_API_URL" --json -y "$@" 2>&1
RESULT=$?
echo "todoai-cli exit code: $RESULT"
echo "=== Edge log ==="
cat /tmp/edge.log 2>/dev/null || echo "(no edge log)"
kill $EDGE_PID 2>/dev/null
exit $RESULT
RUNEOF
chmod +x /usr/local/bin/todoai-run

echo "=== TODOforAI installation complete ==="
