# Terminal-Bench — Where We Left Off

## Status: 🎉 Reward 1.0 — openssl-selfsigned-cert FULLY PASSES (6/6)

Harbor adapter fully working end-to-end. `--allow-all` now injects `*:*` into
agent permissions and the backend honors it. Agent completed all 6 openssl
tests in ~57s.

## Two fixes applied today

### 1. Stale compiled `todoai` binary silently ignored `--allow-all`
The shipped `dist/todoai` predated commit `1941fb5` which added the flag.
Because CLI `parseArgs` uses `strict: false`, unknown flags are **silently
dropped** — no error. Result inside docker: flag was a no-op, every tool call
needed approval, agent hung.

**Fix:** rebuild + copy:
```
cd ~/repo/todoforai/cli && bun build src/index.ts --compile --outfile dist/todoai
cp dist/todoai ~/repo/todoforai/benchmarks/terminal-bench/todoforai_tbench/dist/
```

### 2. Stale harbor container left an edge alive that hijacked tool calls
A previous run left `openssl-selfsigned-cert__expcnfg-main-1` container running
for 25h. Its edge kept reconnecting with the same MACHINE_ID, ping-ponging with
the new container's edge (`4002 Replaced by new connection`). Tool calls landed
in the wrong container — verifier saw no files → reward 0.

**Fix:** `docker rm -f <stale_container>` before re-runs. Long-term: adapter
should kill edge in `teardown()` or force docker container cleanup.

## Previous fix (still in effect): stable machine-id

Added stable `/etc/machine-id` in `setup()` so the edge registers as the **same**
device across runs (no more new `PC_XXXX` per run).

```python
MACHINE_ID = "todoforai-terminal-bench-00000000000000000000"

async def setup(self, environment: BaseEnvironment) -> None:
    await environment.exec(
        command=f"echo {self.MACHINE_ID} > /etc/machine-id", user="root",
    )
    ...
```

## Last trial result (openssl-selfsigned-cert) — `2026-04-22__16-07-17`

**Reward: 1.0** — all 6 tests passed. Agent recovered from missing `cryptography`
module by switching to stdlib `subprocess` + `openssl` calls.

## Key findings

- **`ws` npm package doesn't work in bun** — WebSocket `Unexpected server response: 101` error.
  Compiled bun binaries (`bun build --compile`) use native bun WebSocket which works.
- **Compiled binaries skip all install deps** — no bun/npm/curl needed, install takes <1s.
- **`--add-path /app`** on edge registers workspace path with server.
- **`--api-key`** needed on both edge AND todoai CLI (no credentials.json in container).
- **Production API key** uses `x-api-key` header (not Bearer).

## How to run

```bash
# 1. Build compiled binaries (after CLI/edge code changes)
./scripts/rebuild_binaries.sh

# 2. Run benchmark (no sudo needed — user is in docker group)
export TODOFORAI_API_KEY=<prod-key>
cd ~/repo/todoforai/benchmarks/terminal-bench

# Single task (fast smoke test):
~/.todoforai/tools/venv/bin/harbor run \
  -d "terminal-bench/terminal-bench-2" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  -i "terminal-bench/openssl-selfsigned-cert" \
  --yes -n 1

# Full benchmark (89 tasks, sequential, ~hours):
nohup ~/.todoforai/tools/venv/bin/harbor run \
  -d "terminal-bench/terminal-bench-2" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  --yes -n 1 > jobs/full-run-$(date +%Y%m%d-%H%M%S).log 2>&1 &

# Resume interrupted run:
~/.todoforai/tools/venv/bin/harbor job resume -p jobs/<JOB_DIR>

# Check progress:
cat jobs/<JOB_DIR>/result.json | jq '.stats'
```

## Why `-n 1` (sequential only)

`-n 1` forces **1 trial at a time**. Parallel trials would all register edges
with the **same `MACHINE_ID`** → WebSocket ping-pong (`4002 Replaced by new
connection`) → tool calls land in the wrong container → reward 0.

To enable parallelism: make `MACHINE_ID` per-trial (e.g. append `trial_name`).
Not done yet.

## What needs to happen next

1. **Run full benchmark to completion** — in progress (`2026-04-22__16-17-47`).
2. **Cleanup stale containers** — implement `teardown()` or verify
   harbor's `delete: true` actually removes containers.
3. **Per-trial MACHINE_ID** for parallel runs (`-n > 1`).
4. **Backend hardening (separate concern):** reject unknown `agentSettings.id`
   on todo create. Currently the backend stores phantom IDs from client payload.

## Relevant paths

| What | Path |
|------|------|
| **Harbor adapter** | `benchmarks/terminal-bench/todoforai_tbench/harbor_agent.py` |
| **Install script** | `benchmarks/terminal-bench/todoforai_tbench/install-todoforai.sh.j2` |
| **Compiled binaries** | `benchmarks/terminal-bench/todoforai_tbench/dist/` (gitignored) |
| **Tests** | `benchmarks/terminal-bench/tests/test_harbor_agent.py` |
| **Edge source** | `edge/bun/src/edge.ts` |
| **CLI source** | `cli/src/index.ts` |
| **Harbor binary** | `~/.todoforai/tools/venv/bin/harbor` |
| **Job results** | `benchmarks/terminal-bench/jobs/` |

All paths relative to `~/repo/todoforai/` monorepo root.
