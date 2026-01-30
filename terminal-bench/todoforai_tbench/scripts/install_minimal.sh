#!/bin/bash
# Minimal TODOforAI Installation for Terminal-Bench
#
# This script installs a lightweight agent that uses direct LLM calls
# without the full TODOforAI infrastructure.

set -e

echo "=== Installing TODOforAI Minimal Agent ==="

# Install Python if needed
if ! command -v python3 &> /dev/null; then
    apt-get update -qq
    apt-get install -y -qq python3 python3-pip
fi

# Install minimal dependencies
pip install anthropic openai -q

# Create the minimal agent script
cat > /tmp/todoforai_minimal.py << 'AGENT_EOF'
#!/usr/bin/env python3
"""
Minimal TODOforAI agent for Terminal-Bench.
Uses direct LLM calls without Edge/Backend infrastructure.
"""

import os
import re
import subprocess
import sys
import json

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False

try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


SYSTEM_PROMPT = """You are an expert terminal user solving a task.

Output commands in ```bash ``` blocks. One command per response.
When done, output: TASK_COMPLETE: <summary>
If stuck, output: TASK_FAILED: <reason>
"""


def run_command(cmd):
    """Execute a shell command and return output."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=60
        )
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return "Command timed out"
    except Exception as e:
        return f"Error: {e}"


def extract_command(text):
    """Extract bash command from response."""
    match = re.search(r"```(?:bash|sh)?\s*\n(.*?)\n```", text, re.DOTALL)
    if match:
        cmd = match.group(1).strip().split('\n')[0]
        return cmd
    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: todoforai_minimal.py '<task>'")
        sys.exit(1)

    task = sys.argv[1]

    # Choose provider
    if HAS_ANTHROPIC and os.environ.get("ANTHROPIC_API_KEY"):
        client = anthropic.Anthropic()
        provider = "anthropic"
    elif HAS_OPENAI and os.environ.get("OPENAI_API_KEY"):
        client = openai.OpenAI()
        provider = "openai"
    else:
        print("No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY")
        sys.exit(1)

    messages = [{"role": "user", "content": f"Task: {task}\n\nBegin."}]
    total_input = 0
    total_output = 0

    for iteration in range(50):
        # Call LLM
        if provider == "anthropic":
            response = client.messages.create(
                model="claude-sonnet-4-5-20250514",
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                messages=messages,
            )
            text = response.content[0].text
            total_input += response.usage.input_tokens
            total_output += response.usage.output_tokens
        else:
            response = client.chat.completions.create(
                model="gpt-4o",
                max_tokens=2048,
                messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            )
            text = response.choices[0].message.content
            if response.usage:
                total_input += response.usage.prompt_tokens
                total_output += response.usage.completion_tokens

        messages.append({"role": "assistant", "content": text})

        # Check completion
        if "TASK_COMPLETE:" in text:
            print(f"Task completed: {text}")
            break
        elif "TASK_FAILED:" in text:
            print(f"Task failed: {text}")
            break

        # Execute command
        cmd = extract_command(text)
        if cmd:
            print(f"$ {cmd}")
            output = run_command(cmd)
            print(output[:2000])
            messages.append({"role": "user", "content": f"Output:\n{output[:4000]}"})
        else:
            messages.append({"role": "user", "content": "Please provide a command."})

    # Output token counts
    print(f"\n__TOKENS__")
    print(json.dumps({"input_tokens": total_input, "output_tokens": total_output}))


if __name__ == "__main__":
    main()
AGENT_EOF

chmod +x /tmp/todoforai_minimal.py

echo "=== Minimal agent installed ==="
