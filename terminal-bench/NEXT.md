# Terminal-Bench — Where We Left Off

## Status: First run attempt — `install` abstract method missing

Harbor agent adapter simplified, but hit runtime error:
```
TypeError: Can't instantiate abstract class TODOforAIHarborAgent without an implementation for abstract method 'install'
```

## What needs to happen next

1. **Add `install()` method** to `harbor_agent.py` — the `BaseInstalledAgent` requires it.
   The install script template (`install-todoforai.sh.j2`) is already there, just need to wire it up:
   ```python
   async def install(self, environment: BaseEnvironment) -> None:
       await self.exec_as_root(environment, command="bash /installed-agent/install-todoforai.sh")
   ```
   Or check how other Harbor agents implement `install()` — it may need to render the `.j2` template first.

2. **Run the first test**:
   ```bash
   export TODOFORAI_API_KEY=$(python3 -c "import json; print(json.load(open('$HOME/.todoforai/credentials.json'))['https://api.todofor.ai'])")
   cd ~/repo/todoforai/benchmarks/terminal-bench
   sudo -E ~/.todoforai/tools/venv/bin/harbor run \
     -d "terminal-bench/terminal-bench-2" \
     --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
     -i "terminal-bench/openssl-selfsigned-cert" \
     --yes
   ```

3. **Docker permission** — `sudo -E` needed because user not yet in docker group (relogin needed).

## What was done

- Simplified `harbor_agent.py`: removed key pool, dotenv, project flag, env handling
- API key comes from `TODOFORAI_API_KEY` env var (read from `~/.todoforai/credentials.json` on host)
- Edge gets `--api-key` flag, no other env vars needed
- Installed Harbor (`uv tool install harbor`) + adapter (`pip install -e .`) + Docker

## Relevant paths

| What | Path |
|------|------|
| **This adapter** | `benchmarks/terminal-bench/todoforai_tbench/harbor_agent.py` |
| **Install script** | `benchmarks/terminal-bench/todoforai_tbench/install-todoforai.sh.j2` |
| **Legacy agent (tb CLI)** | `benchmarks/terminal-bench/todoforai_tbench/agent.py` |
| **Edge source** | `edge/bun/src/edge.ts` |
| **CLI source** | `cli/src/index.ts` |
| **Edge credentials** | `~/.todoforai/credentials.json` |
| **Harbor binary** | `~/.todoforai/tools/venv/bin/harbor` |

All paths relative to `~/repo/todoforai/` monorepo root.
Work was done from `~/repo/todoforai/browser-extension/` but the adapter lives in `~/repo/todoforai/benchmarks/terminal-bench/`.
