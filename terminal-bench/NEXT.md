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
cd ~/repo/todoforai/benchmarks/terminal-bench

# Load 6 dev API keys for parallel runs (MACHINE_ID = hash(key) → no collision):
export TODOFORAI_API_KEYS_FILE=$PWD/dev_api_keys.txt
# (or: export TODOFORAI_API_KEYS=$(awk '{print $1}' dev_api_keys.txt | paste -sd,))

# Single task (fast smoke test, 1 key enough):
~/.todoforai/tools/venv/bin/harbor run \
  -d "terminal-bench/terminal-bench-2" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  -i "terminal-bench/openssl-selfsigned-cert" \
  --yes -n 1

# Full benchmark parallel (6 keys → -n 6, ~6× faster):
nohup ~/.todoforai/tools/venv/bin/harbor run \
  -d "terminal-bench/terminal-bench-2" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  --yes -n 6 > jobs/full-run-$(date +%Y%m%d-%H%M%S).log 2>&1 &

# Resume interrupted run:
~/.todoforai/tools/venv/bin/harbor job resume -p jobs/<JOB_DIR>

# Check progress:
cat jobs/<JOB_DIR>/result.json | jq '.stats'
```

## Monitoring a running benchmark

```bash
# Is harbor still running?
ps -p <PID> -o pid,etime,cmd
# Or find it:
ps aux | grep "harbor (run|job resume)" | grep -v grep

# Which task is currently in the docker container?
docker ps --format "{{.Names}} | {{.Status}}"

# Progress summary (n done / total, reward counts, trial names):
cat jobs/<JOB_DIR>/result.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
s = d['stats']
print(f\"Done: {s['n_trials']} / {d['n_total_trials']}\")
for v in s['evals'].values():
    for r, t in sorted(v['reward_stats']['reward'].items()):
        print(f'  reward={r}: {len(t)}')
        for x in t: print(f'    {x}')
"

# Which trial dirs exist and whether each finished:
for d in jobs/<JOB_DIR>/*__*/; do
  r=$(python3 -c "import json; print(json.load(open('$d/result.json'))['verifier_result']['rewards']['reward'])" 2>/dev/null || echo "PENDING")
  echo "$(basename $d): $r"
done

# Why did a trial fail? (verifier pytest output)
tail -40 jobs/<JOB_DIR>/<trial>/verifier/test-stdout.txt

# Agent side: what did the AI actually do? (chat + tool calls)
curl -s -H "x-api-key: $TODOFORAI_API_KEY" \
  "https://api.todofor.ai/api/v1/todos/<TODO_ID>" | python3 -m json.tool

# Only ONE edge registered? (machine-id fix sanity)
curl -s -H "x-api-key: $TODOFORAI_API_KEY" https://api.todofor.ai/api/v1/edges
```

## Stop / resume gotchas

- `kill <harbor_pid>` stops the python process. The docker container running the
  current trial is **usually** killed with it (verified).
- Trial dirs without `result.json` are half-finished — delete them before
  `job resume` so the trial reruns cleanly:
  ```
  rm -rf jobs/<JOB_DIR>/<trial-without-result.json>
  harbor job resume -p jobs/<JOB_DIR>
  ```
- Long-running stuck tasks (e.g. `path-tracing`, `compile-compcert`) can take
  15+ minutes. Don't kill too early — check `docker ps` and `docker top` for
  activity before assuming hang.
- After a kill, always `docker ps` and `docker rm -f` any leftover containers
  before starting a new run (stale edges hijack tool calls — see fix #2 above).

## Task flakiness (agent-side, not adapter)

Individual reruns show significant variance on borderline tasks:
- `protein-assembly`: ❌ then ✅ (bioinformatics ordering)
- `break-filter-js-from-html`: ❌ then ✅ (XSS bypass)
- `video-processing`: ❌ then ❌ (frame-detection pixel precision — consistent miss)

Frame-pixel-precision tasks appear to be a systematic weakness; logic/code tasks
are retry-recoverable.

## Parallelism (`-n N`)

`MACHINE_ID = sha256("todoforai-tb:" + api_key)[:32]` — per-API-key device.
Combined with `_ApiKeyPool` (asyncio queue mutex), each key is held by at most
one trial at a time → no `4002 Replaced`. Set `N <= len(keys)`; extra trials
block on `acquire()` until a key frees up.

Key sources (priority): `TODOFORAI_API_KEYS` (csv) > `TODOFORAI_API_KEYS_FILE`
(one key per line, first whitespace token, `#` comments) > `TODOFORAI_API_KEY`.

## What needs to happen next

1. **Run full parallel benchmark** with 6 keys, `-n 6`.
2. **Auto-cleanup half-finished trial dirs on resume** — harbor doesn't
   currently rerun a trial dir that exists without `result.json`; adapter or a
   pre-resume script should `rm -rf` them.
3. **Retry policy for known-flaky tasks** — add `-k 2` (n-attempts) or a
   selective rerun of `reward=0.0` trials after the full sweep.
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
