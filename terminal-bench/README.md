# TODOforAI Terminal-Bench Adapter

[Terminal-Bench](https://github.com/terminal-bench/terminal-bench) adapter for evaluating the TODOforAI agent in Docker containers.

## Quick Start

### Harbor (Terminal-Bench 2.0)

```bash
# 1. Install the adapter (from this directory)
pip install -e .

# 2. Set up API keys (see "API Keys" section below)
export TODOFORAI_API_KEYS="key1,key2,..."
export TODOFORAI_API_URL="http://172.17.0.1:4000"  # local dev backend

# 3. Run a benchmark
harbor run -d "terminal-bench@2.0" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  --task-id hello-world
```

### Legacy (`tb` CLI, terminal-bench-core 0.1.x)

```bash
tb run --dataset "terminal-bench-core==0.1.1" \
  --agent-import-path "todoforai_tbench:TODOforAIAgent" \
  --task-id hello-world \
  --livestream
```

## Prerequisites

- Python 3.10+
- Docker (tasks run in isolated containers)
- `terminal-bench` CLI: `pip install terminal-bench`
- A running TODOforAI backend (local dev or production)

## API Keys

Each Docker container needs its own API key. The adapter fails immediately with a clear error if no keys are configured.

| Variable | Format | Description |
|----------|--------|-------------|
| `TODOFORAI_API_KEYS` | `key1,key2,key3` | Comma-separated pool for concurrent runs |
| `TODOFORAI_API_KEYS_FILE` | `/path/to/keys.txt` | File with one key per line |
| `TODOFORAI_API_KEY` | `single-key` | Single key (for serial runs only) |

Priority: `TODOFORAI_API_KEYS` > `TODOFORAI_API_KEYS_FILE` > `TODOFORAI_API_KEY`

You can also put these in a `.env` file in your working directory — it's auto-loaded.

### Generating Dev Keys

Run the dev account creation script against your local backend:

```bash
# Backend must be running (pm2 status → backend)
./scripts/create_dev_accounts.sh

# Or with a custom backend URL
./scripts/create_dev_accounts.sh http://localhost:4000
```

This creates accounts via the email OTP flow (OTPs are extracted from PM2 backend logs) and outputs a `TODOFORAI_API_KEYS` export command you can copy-paste.

Customize with env vars: `NUM_ACCOUNTS`, `EMAIL_PREFIX`, `EMAIL_DOMAIN`.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TODOFORAI_API_KEYS` | Yes* | - | API key(s) — see above |
| `TODOFORAI_API_URL` | No | production | API endpoint (use `http://172.17.0.1:4000` for local dev) |
| `TODOFORAI_PROJECT_ID` | No | - | Specific project ID to use |

*At least one of the three key variables must be set.

Note: `172.17.0.1` is Docker's default host gateway — it lets containers reach your host's `localhost:4000`.

## Running Benchmarks

### Single task

```bash
tb run --dataset "terminal-bench-core==0.1.1" \
  --agent-import-path "todoforai_tbench:TODOforAIAgent" \
  --task-id hello-world \
  --livestream \
  --output-path runs
```

### Concurrent tasks

Match `--n-concurrent` to your number of API keys:

```bash
export TODOFORAI_API_KEYS="key1,key2,key3"

tb run --dataset "terminal-bench-core==0.1.1" \
  --agent-import-path "todoforai_tbench:TODOforAIAgent" \
  --n-concurrent 3 \
  --output-path runs
```

### Common flags

| Flag | Description |
|------|-------------|
| `--task-id <id>` | Run a specific task (omit to run all) |
| `--n-concurrent N` | Parallel containers (default 1) |
| `--livestream` | Stream agent output in real-time |
| `--output-path runs` | Save results to `runs/` directory |
| `--global-test-timeout-sec N` | Override test timeout (default varies by task) |

### Available tasks

List tasks in the dataset:

```bash
tb list-tasks --dataset "terminal-bench-core==0.1.1"
```

## Rebuilding Dist

The adapter ships pre-built JS bundles for `todoai` and `todoforai-edge` in `todoforai_tbench/dist/`. These are copied into Docker containers during task setup.

After modifying either package, rebuild:

```bash
./scripts/rebuild_wheels.sh
```

This bundles from the monorepo source (`../../cli` and `../../edge/bun`) and places them in `todoforai_tbench/dist/`.

Override source paths with `CLI_DIR` and `EDGE_DIR` env vars.

## How It Works

1. Terminal-bench spins up a Docker container for each task
2. The adapter copies dist files into the container and runs `install.sh`
3. `install.sh` installs bun, then installs `todoai` and `todoforai-edge` (from dist or npm)
4. `todoforai-edge --path /app` is started in the background
5. The task instruction is piped into `todoai --non-interactive --dangerously-skip-permissions`
6. `todoai` creates a TODO and streams output; the edge executes blocks inside the container
7. Terminal-bench runs pytest to verify the task was completed correctly

## Troubleshooting

**"No TODOforAI API keys configured"** — Set one of the key environment variables. See "API Keys" above.

**401 UNAUTHORIZED inside container** — Your API key is invalid or expired. Regenerate dev keys with `./scripts/create_dev_accounts.sh`.

**"No tasks found matching pattern"** — Make sure you include the dataset version: `--dataset "terminal-bench-core==0.1.1"` (not just `terminal-bench-core`).

**Agent only runs one turn** — Complex tasks may need multiple LLM turns. The CLI's idle timeout is 60s; if the backend doesn't produce a second turn within that window, the CLI exits. This is typically a backend/agent-side issue.

**Dist changes not taking effect** — Run `./scripts/rebuild_wheels.sh` after modifying `cli` or `edge`. The bundles in `todoforai_tbench/dist/` are what gets installed in containers.

## Development

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest
```
