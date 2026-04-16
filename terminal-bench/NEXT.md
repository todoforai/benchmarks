# Terminal-Bench — Where We Left Off

## Status: First successful trial — agent runs but reward=0.0

The Harbor adapter is fully functional. First trial completed without exceptions,
but the agent didn't produce the expected output files (reward=0.0, 6/6 tests failed).

## What was fixed

1. **Added `install()` method** to `harbor_agent.py` — uploads and runs the install script
2. **Installed Docker Compose plugin** — was missing (`docker compose` subcommand not found)
3. **Fixed install script** — bun/node/todoai/edge now symlinked to `/usr/local/bin` so agent user can find them
4. **Fixed edge CLI flags** — `--path` → `--add-path` (edge doesn't accept `--path`)
5. **Added `--api-key` to todoai CLI** — without it, todoai opens browser auth prompt
6. **Updated tests** — removed stale key-pool tests, added install method tests

## What needs to happen next

1. **Debug why agent produces no output** — the todoai CLI ran for ~4min but created no files in `/app/`.
   Possible causes:
   - Edge might not be connecting properly (check if WebSocket connects to API)
   - todoai might be waiting for something or erroring silently
   - The agent might be working in wrong directory
   
   To debug, add `--debug` flag to both edge and todoai in `harbor_agent.py:run()`,
   or check the todo on the web UI to see what happened.

2. **Run again with more visibility**:
   ```bash
   export TODOFORAI_API_KEY=$(python3 -c "import json; print(json.load(open('$HOME/.todoforai/credentials.json'))['https://api.todofor.ai'])")
   cd ~/repo/todoforai/benchmarks/terminal-bench
   sudo -E ~/.todoforai/tools/venv/bin/harbor run \
     -d "terminal-bench/terminal-bench-2" \
     --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
     -i "terminal-bench/openssl-selfsigned-cert" \
     --yes --debug -n 1
   ```

3. **Check the last trial results**:
   ```
   jobs/2026-04-16__13-24-08/openssl-selfsigned-cert__vzc3YEN/
   ```

## Last trial timeline

| Phase | Duration |
|-------|----------|
| Environment setup | ~5s |
| Agent setup (install) | ~8s |
| Agent execution | ~4min |
| Verifier | ~5s |

## Relevant paths

| What | Path |
|------|------|
| **Harbor adapter** | `benchmarks/terminal-bench/todoforai_tbench/harbor_agent.py` |
| **Install script** | `benchmarks/terminal-bench/todoforai_tbench/install-todoforai.sh.j2` |
| **Tests** | `benchmarks/terminal-bench/tests/test_harbor_agent.py` |
| **Edge source** | `edge/bun/src/edge.ts` |
| **Edge config** | `edge/bun/src/config.ts` |
| **CLI source** | `cli/src/index.ts` |
| **Harbor binary** | `~/.todoforai/tools/venv/bin/harbor` |
| **Credentials** | `~/.todoforai/credentials.json` |

All paths relative to `~/repo/todoforai/` monorepo root.
