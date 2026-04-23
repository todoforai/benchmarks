# Terminal-Bench — Where We Left Off

## Status: Full run in progress — 21/89 done (12 pass, 9 fail, 57%)

Job dir: `jobs/2026-04-22__16-17-47` — tracked in git, resumable on any machine.

## Results so far

### ✅ Passed (reward=1.0)
- circuit-fibsqrt
- overfull-hbox
- crack-7z-hash
- path-tracing
- vulnerable-secret
- make-mips-interpreter
- openssl-selfsigned-cert
- log-summary-date-ranges
- distribution-search
- build-pov-ray
- dna-insert
- cancel-async-tasks

### ❌ Failed (reward=0.0)
- **compile-compcert** — agent timeout (Coq build too slow for default timeout)
- **dna-assembly** — agent backgrounded `apt-get &`, verifier hit dpkg lock
- **caffe-cifar-10** — agent gave up, only created prototxt files
- **protein-assembly** — bioinformatics ordering wrong
- **video-processing** — frame-detection pixel precision miss
- **break-filter-js-from-html** — XSS bypass not found
- **polyglot-rust-c** — left extra files in output dir (test expects only main.rs)
- **feal-linear-cryptanalysis** — TBD
- **install-windows-3-11** — TBD
- **db-wal-recovery** — TBD
- **extract-elf** — TBD

## Fixes applied this session

### 1. DEBIAN_FRONTEND=noninteractive in setup
Agent-spawned `apt-get` commands were blocking on debconf prompts (e.g. tzdata).
Now set in `/etc/environment` + `/root/.bashrc` during `setup()`.

### 2. Finally cleanup block in run()
After agent exits (or times out), kill leftover processes (edge, apt-get, dpkg)
so they don't hold dpkg lock or hijack tool calls for the verifier.

```python
finally:
    await environment.exec(
        command=(
            "pkill -9 -f todoforai-edge 2>/dev/null; "
            "pkill -9 -f todoai 2>/dev/null; "
            "pkill -9 -f 'apt-get|^apt |dpkg' 2>/dev/null; "
            "timeout 30 sh -c 'while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 1; done'; "
            "true"
        ),
        user="root",
    )
```

### 3. Job results tracked in git
Removed old test runs, kept only the main full run. `jobs/.gitignore` un-ignores
`*.json` and `*.txt` (overriding root `*.json` ignore). Log files still ignored.

## Previous fixes (still in effect)

- **Stable machine-id** — `/etc/machine-id` set in `setup()` so edge registers
  as same device across runs.
- **Compiled bun binaries** — no runtime deps needed, install <1s.
- **`--allow-all`** flag on todoai CLI for unattended tool execution.

## How to run

```bash
# 1. Build compiled binaries (after CLI/edge code changes)
./scripts/rebuild_binaries.sh

# 2. Resume the existing run (on any machine with docker)
export TODOFORAI_API_KEY=<prod-key>
cd ~/repo/todoforai/benchmarks/terminal-bench
~/.todoforai/tools/venv/bin/harbor job resume -p jobs/2026-04-22__16-17-47

# 3. Or start fresh full benchmark
nohup ~/.todoforai/tools/venv/bin/harbor run \
  -d "terminal-bench/terminal-bench-2" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  --yes -n 1 > jobs/full-run-$(date +%Y%m%d-%H%M%S).log 2>&1 &
```

## Monitoring

```bash
# Progress
cat jobs/2026-04-22__16-17-47/result.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
s = d['stats']
print(f\"Done: {s['n_trials']} / {d['n_total_trials']}\")
for v in s['evals'].values():
    for r, t in sorted(v['reward_stats']['reward'].items()):
        print(f'  reward={r}: {len(t)}')
        for x in t: print(f'    {x}')
"

# Current task
docker ps --format "{{.Names}} | {{.Status}}"

# Why did a trial fail?
tail -40 jobs/2026-04-22__16-17-47/<trial>/verifier/test-stdout.txt
```

## Stop / resume

```bash
# Stop
kill <harbor_pid>
docker rm -f $(docker ps -q) 2>/dev/null

# Clean half-finished trials before resume
for d in jobs/2026-04-22__16-17-47/*__*/; do
  [ ! -f "$d/result.json" ] && rm -rf "$d"
done

# Resume
~/.todoforai/tools/venv/bin/harbor job resume -p jobs/2026-04-22__16-17-47
```

## What needs to happen next

1. **Finish the full 89-task run** — 68 tasks remaining, ~5 min/task avg.
2. **Parallelization** — needs per-account API keys (not per-trial MACHINE_ID).
   Each parallel runner needs its own todoforai account + API key + edge.
   Multiple harbor processes, each with different `TODOFORAI_API_KEY` env.
3. **Localhost backend** — backend runs on localhost:4000 (same prod DB via
   Dragonfly). Auth issue: prod API key returns 401 on localhost. Investigate.
4. **Retry flaky tasks** — selective rerun of `reward=0.0` trials after full sweep.
5. **Edge process group kill** — `interruptBlock()` in `edge/bun/src/shell.ts`
   only kills the direct child, not descendants. Background `apt-get` survives.
   Fix: use `process.kill(-pid)` for process group kill.

## Key findings

- **`ws` npm package doesn't work in bun** — use native bun WebSocket.
- **Compiled binaries skip all install deps** — no bun/npm/curl needed.
- **`--add-path /app`** on edge registers workspace path with server.
- **`--api-key`** needed on both edge AND todoai CLI.
- **Production API key** uses `x-api-key` header (not Bearer).
- **`-n 1` only** — parallel trials with same MACHINE_ID cause edge ping-pong.
- **Agent timeout** is the main failure mode for heavy-build tasks (compcert, caffe).
- **Agent backgrounding apt** (`apt-get &`) causes dpkg lock conflicts for verifier.

## Relevant paths

| What | Path |
|------|------|
| **Harbor adapter** | `benchmarks/terminal-bench/todoforai_tbench/harbor_agent.py` |
| **Install script** | `benchmarks/terminal-bench/todoforai_tbench/install-todoforai.sh.j2` |
| **Compiled binaries** | `benchmarks/terminal-bench/todoforai_tbench/dist/` (gitignored) |
| **Edge shell (timeout/kill)** | `edge/bun/src/shell.ts` |
| **CLI source** | `cli/src/index.ts` |
| **Job results** | `benchmarks/terminal-bench/jobs/2026-04-22__16-17-47/` |

All paths relative to `~/repo/todoforai/` monorepo root.
