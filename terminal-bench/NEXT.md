# Terminal-Bench — Where We Left Off

## Status: Adapter fully working — 5/6 tests pass, stable machine-id added

Harbor adapter fully working. Compiled bun binaries solved the `ws` WebSocket
compatibility issue. Agent completes tasks in ~30s. No more `sudo -E` needed
(docker group membership active after reboot).

## Latest fix (needs verification run)

Added stable `/etc/machine-id` in `setup()` so the edge registers as the **same**
device across runs (no more new `PC_XXXX` per run). All stale edges + stale "app"
agent were deleted via API — next run starts clean.

```python
MACHINE_ID = "todoforai-terminal-bench-00000000000000000000"

async def setup(self, environment: BaseEnvironment) -> None:
    await environment.exec(
        command=f"echo {self.MACHINE_ID} > /etc/machine-id", user="root",
    )
    ...
```

## Last trial result (openssl-selfsigned-cert)

| Test | Result |
|------|--------|
| test_directory_structure | ✅ PASSED |
| test_key_file | ✅ PASSED |
| test_certificate_file | ✅ PASSED |
| test_combined_pem_file | ✅ PASSED |
| test_verification_file | ✅ PASSED |
| test_python_verification_script | ❌ FAILED — `cryptography` module not installed |

Reward is 0.0 because all tests must pass. The AI agent used `from cryptography import x509`
in `check_cert.py` but the container doesn't have that pip package. This is an agent decision
issue, not an adapter problem.

## Key findings

- **`ws` npm package doesn't work in bun** — WebSocket `Unexpected server response: 101` error.
  Compiled bun binaries (`bun build --compile`) use native bun WebSocket which works.
- **Compiled binaries skip all install deps** — no bun/npm/curl needed, install takes <1s.
- **`--add-path /app`** on edge registers workspace path with server.
- **`--api-key`** needed on both edge AND todoai CLI (no credentials.json in container).
- **Production API key** uses `x-api-key` header (not Bearer).

## How to run

```bash
# 1. Build compiled binaries (once, or after code changes)
cd ~/repo/todoforai/edge/bun && bun build src/index.ts --compile --outfile dist/todoforai-edge
cd ~/repo/todoforai/cli && bun build src/index.ts --compile --outfile dist/todoai

# 2. Copy to adapter dist/
cp ~/repo/todoforai/edge/bun/dist/todoforai-edge ~/repo/todoforai/benchmarks/terminal-bench/todoforai_tbench/dist/
cp ~/repo/todoforai/cli/dist/todoai ~/repo/todoforai/benchmarks/terminal-bench/todoforai_tbench/dist/

# 3. Run benchmark (no sudo needed — user is in docker group)
export TODOFORAI_API_KEY=0f666800f6e7930136eef8cdbb6ed81ca5707f6ff1be605bbe9820860e588e00
cd ~/repo/todoforai/benchmarks/terminal-bench
~/.todoforai/tools/venv/bin/harbor run \
  -d "terminal-bench/terminal-bench-2" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  -i "terminal-bench/openssl-selfsigned-cert" \
  --yes -n 1

# Verify only ONE edge registered (machine-id fix works):
curl -H "x-api-key: $TODOFORAI_API_KEY" https://api.todofor.ai/api/v1/edges
```

## What needs to happen next

1. **Verify machine-id fix** — run once, check `GET /api/v1/edges` returns 1 entry.
   Run again, should still be 1 (same fingerprint → same device).
2. **Run full benchmark** — remove `-i` filter to run all tasks.
3. **Improve agent quality** — the 1 failing test is an agent decision (used `cryptography` lib
   that isn't installed). Could pre-install common pip packages or tune the prompt.
4. **Automate binary rebuild** — add `scripts/rebuild_binaries.sh`.

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
