# TODOforAI Terminal-Bench Adapter

[Terminal-Bench](https://github.com/terminal-bench/terminal-bench) adapter for evaluating the TODOforAI agent.

## Installation

```bash
pip install todoforai-tbench
```

## Usage

```bash
tb run --dataset terminal-bench-core==0.1.1 \
  --agent-import-path todoforai_tbench:TODOforAIAgent \
  --task-id hello-world
```

## Configuration

| Environment Variable | Description |
|---------------------|-------------|
| `TODOFORAI_API_KEY` | Single API key (simplest setup) |
| `TODOFORAI_API_KEYS` | Comma-separated key pool for concurrent runs |
| `TODOFORAI_API_KEYS_FILE` | Path to file with one key per line |
| `TODOFORAI_API_URL` | API URL (defaults to production) |

### API Key Pool

When running multiple tasks concurrently, each Docker container gets a unique key from the pool. If all keys are in use, additional tasks block until a key is returned. This ensures no two containers share a key simultaneously.

```bash
# Option 1: Comma-separated
export TODOFORAI_API_KEYS="key-1,key-2,key-3"

# Option 2: Keys file
export TODOFORAI_API_KEYS_FILE=/path/to/keys.txt

# Then run with concurrency matching your key count
tb run --dataset terminal-bench-core==0.1.1 \
  --agent-import-path todoforai_tbench:TODOforAIAgent \
  --max-concurrent 3
```
