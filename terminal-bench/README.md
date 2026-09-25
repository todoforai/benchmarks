# TODOforAI Terminal-Bench Adapter

[Harbor](https://github.com/laude-institute/harbor) adapter that runs the TODOforAI agent on
Terminal-Bench 2.1 (`terminal-bench/terminal-bench-2-1`). Read `LESSONS.md` before a sweep.

## Setup

```bash
pip install -e .                       # Python 3.10+, Docker
echo "<api-key> <email>" > dev_api_keys.txt   # or export TODOFORAI_API_KEY
scripts/check_tiers.sh                 # must be a paid tier (hobby is clamped to Sonnet)
```

One account runs every trial: `todoforai-cli --isolated` gives each trial its own
todo-scoped mayfly bridge, so concurrent trials don't collide. The account needs an
agent named `app` (the benchmark config: tool deny list, sysmsg — see the
`terminal-bench-82` registry template); the model comes from harbor's `-m`.

| Variable | Default | Description |
|----------|---------|-------------|
| `TODOFORAI_API_KEY` | first key in `dev_api_keys.txt` | Account key (`x-api-key` header) |
| `TODOFORAI_API_URL` | `https://api.todofor.ai` | Backend (`http://172.17.0.1:4000` = host's local dev) |

## Running

```bash
./run_single.sh terminal-bench/<task>          # one task, preflights the key + `app` agent
TB_MODEL=anthropic:anthropic/claude-opus-5.5 \
  scripts/run_batches.sh <prefix> 10 5         # full sweep: batches of 10, 5 concurrent
scripts/progress.sh                            # infra damage vs real fails
scripts/verify_model.sh jobs/<job>             # model that actually served each trial
```

## Rebuilding dist

`todoforai_tbench/dist/` holds compiled `todoforai-cli` / `todoforai-bridge` binaries
copied into each container. After changing `cli` or `bridge`: `scripts/rebuild_binaries.sh`.

## How it works

1. Harbor starts a Docker container per task; the adapter uploads `dist/` and runs `install-todoforai.sh.j2`.
2. The instruction is piped into `todoforai-cli --isolated --non-interactive --allow-all --agent app`.
3. The CLI mints a mayfly bridge inside the container; the agent's tool calls run there.
4. Harbor runs the task's tests and writes `verifier/reward.txt`.

## Development

```bash
pip install -e ".[dev]" && pytest
```
