# TODOforAI Terminal-Bench Adapter

This adapter integrates TODOforAI with [Terminal-Bench](https://tbench.ai/), the industry-standard benchmark for evaluating AI coding agents in terminal environments.

## Installation

```bash
# Install Terminal-Bench
uv tool install terminal-bench
# OR
pip install terminal-bench

# Install this adapter
pip install -e .
```

## Quick Start

### 1. Test with a single task

```bash
# Using the CLI
tb run \
    --dataset terminal-bench-core==head \
    --agent-import-path todoforai_tbench:TODOforAIAgent \
    --task-id hello-world

# Or use our wrapper script
python run_benchmark.py --task-id hello-world
```

### 2. Run full benchmark

```bash
# Run all tasks with 8 concurrent workers
tb run \
    --dataset terminal-bench-core==0.1.1 \
    --agent-import-path todoforai_tbench:TODOforAIAgent \
    --n-concurrent 8

# Or use our wrapper
python run_benchmark.py --dataset terminal-bench-core --concurrent 8
```

### 3. Run Terminal-Bench 2.0 (harder)

```bash
# Using Harbor framework
harbor run -d terminal-bench@2.0 \
    -a todoforai \
    -m anthropic/claude-sonnet-4-5 \
    -n 32
```

## Configuration

Set environment variables:

```bash
export ANTHROPIC_API_KEY="your-key"      # For Claude models
export OPENAI_API_KEY="your-key"         # For GPT models
export TODOFORAI_API_URL="https://..."   # TODOforAI backend URL
export TODOFORAI_API_KEY="your-key"      # TODOforAI API key
```

Or use a config file at `~/.todoforai/tbench.json`:

```json
{
  "api_url": "https://api.todoforai.com",
  "api_key": "your-key",
  "default_model": "claude-sonnet-4-5",
  "default_agent": "terminal",
  "timeout": 600,
  "log_dir": "./logs"
}
```

## Agent Variants

### 1. TODOforAIAgent (BaseAgent)

Full Python integration with direct tmux session control:

```python
from todoforai_tbench import TODOforAIAgent

# Used automatically by tb run --agent-import-path
```

### 2. TODOforAIInstalledAgent (AbstractInstalledAgent)

For leaderboard submissions - installs todoai-cli in the container:

```python
from todoforai_tbench import TODOforAIInstalledAgent

# tb run --agent-import-path todoforai_tbench:TODOforAIInstalledAgent
```

## Architecture

```
Terminal-Bench Harness
    │
    ▼
┌─────────────────────────────────┐
│  TODOforAIAgent (Python)        │
│  - Receives task_description    │
│  - Gets TmuxSession handle      │
│  - Connects Edge to backend     │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  TODOforAI Backend              │
│  - Creates TODO with task       │
│  - Triggers Julia Agent         │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Julia Agent (TODO4AI.jl)       │
│  - LLM calls via backend        │
│  - Tool execution via Edge      │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Edge (in-container)            │
│  - Intercepts BASH tool calls   │
│  - Routes to tmux session       │
└─────────────────────────────────┘
```

## Results

Results are saved to `./results/` by default:

```
results/
├── run_2024-01-30_12-00-00/
│   ├── summary.json          # Overall stats
│   ├── tasks/
│   │   ├── hello-world/
│   │   │   ├── result.json   # Task result
│   │   │   └── logs/         # Agent logs
│   │   └── ...
│   └── leaderboard.json      # Formatted for submission
```

## Submitting to Leaderboard

After a successful run:

```bash
# Generate submission file
python submit.py --run-dir ./results/run_2024-01-30_12-00-00

# Submit via PR to HuggingFace
# See: https://tbench.ai/docs/submitting
```

## Troubleshooting

### Agent can't connect to Edge

Ensure the Edge client is running:
```bash
todoforai-edge start
```

### Timeout errors

Increase timeout:
```bash
python run_benchmark.py --timeout 900  # 15 minutes
```

### Permission denied

The agent needs access to the tmux session. Check Docker permissions.
