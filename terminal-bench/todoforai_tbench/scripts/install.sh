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

# Install todoai-cli
echo "Installing todoai-cli..."
pip install todoai-cli -q

# Verify installation
echo "Verifying installation..."
todoai-cli --version || echo "todoai-cli installed (version command may not exist)"

# Create wrapper script that activates venv
cat > /usr/local/bin/todoai-cli-wrapper << 'EOF'
#!/bin/bash
source /opt/todoforai-venv/bin/activate
exec todoai-cli "$@"
EOF
chmod +x /usr/local/bin/todoai-cli-wrapper

# Create symlink
ln -sf /usr/local/bin/todoai-cli-wrapper /usr/local/bin/todoai-cli 2>/dev/null || true

echo "=== TODOforAI installation complete ==="
