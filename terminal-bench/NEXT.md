# Terminal-Bench — Where We Left Off

## Status: 🎉 Full benchmark runs on 89 tasks × 2 models

Adapter stable. Parallel runs (6 keys, `-n 6`) complete in ~1.5–2h per model.

### Latest results (benchmark: `terminal-bench/terminal-bench-2`, 89 tasks)

| Model | Job dir | Pass | Fail | Pass rate |
|-------|---------|-----:|-----:|----------:|
| `anthropic:anthropic/claude-opus-4.7` | `jobs/2026-04-22__16-17-47/` | 54 | 35 | **60.7 %** |
| `anthropic:anthropic/claude-opus-4.6` | `jobs/opus-4.6__2026-04-23__17-37-27/` | 42 | 47 | **47.2 %** |

opus-4.7 beats opus-4.6 by ~13.5 pp on this bench.

Note: the 4.7 run predates `--job-name` convention — use the mtime + `model.json`
(add one if missing) to attribute runs. Future runs must use `--job-name
<model>__<timestamp>` so the directory is self-describing.

## Earlier status: openssl-selfsigned-cert passes 6/6

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

## Configuring dev accounts (agent settings per API key)

Each API key is a separate account with its own `app` agent (created on first
run, workspace path `/app`). Configure via REST `/api/v1/*` with `x-api-key`.

**Bootstrap app agents** (must run once per new key so `app` agent exists):

```bash
cd ~/repo/todoforai/benchmarks/terminal-bench
unset TODOFORAI_API_KEYS_FILE TODOFORAI_API_KEYS
while read -r key email; do
  [ -z "$key" ] && continue
  echo "=== $email ==="
  TODOFORAI_API_KEY=$key ~/.todoforai/tools/venv/bin/harbor run \
    -d "terminal-bench/terminal-bench-2" \
    --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
    -i "terminal-bench/openssl-selfsigned-cert" --yes -n 1 \
    2>&1 | grep -E "Reward|Total runtime" | tail -2
done < dev_api_keys.txt
```

**Global deny (cloud tools except webfetch + google_search):**

```bash
URL="https://api.todofor.ai/api/v1"
PAYLOAD='{"permissions":{"allow":["todoai_cloud:webfetch","todoai_cloud:google_search"],"ask":[],"deny":["todoai_edge:REVIEW","todoai_cloud:browser_automation","todoai_cloud:intro","todoai_cloud:todoforai_api","todoai_cloud:vault_access","todoai_cloud:business_context","todoai_cloud:image_gen","todoai_cloud:create_todo","todoai_cloud:update_agent_settings"]}}'
while read -r key email; do
  [ -z "$key" ] && continue
  curl -sS -X PUT -H "x-api-key: $key" -H "Content-Type: application/json" \
    -d "$PAYLOAD" "$URL/agents/global" | jq -c '.permissions.deny | length'
done < dev_api_keys.txt
```

**Set model on the `app` agent** (per-key):

```bash
URL="https://api.todofor.ai/api/v1"
MODEL="anthropic:anthropic/claude-opus-4.6"   # or claude-opus-4.7, etc.
while read -r key email; do
  [ -z "$key" ] && continue
  aid=$(curl -sS -H "x-api-key: $key" "$URL/agents?name=app" | jq -r '.[0].id')
  curl -sS -X PUT -H "x-api-key: $key" -H "Content-Type: application/json" \
    -d "{\"agentSettingsId\":\"$aid\",\"updates\":{\"model\":\"$MODEL\"}}" \
    "$URL/agents/$aid/settings" > /dev/null
  echo "$email: set"
done < dev_api_keys.txt
```

Known model identifiers (verified working):
- `anthropic:anthropic/claude-opus-4.6`
- `anthropic:anthropic/claude-opus-4.7`

**Note:** `GET /agents?name=app` returns `"model": "claude"` as the default/alias
when no explicit model is set. Always set an explicit identifier before a
benchmark run so results are attributable.

**Per-agent systemMessage on the `app` agent** (bench-tuned reflection prompt):

```bash
URL="https://api.todofor.ai/api/v1"
MSG="Before you finish go over each statement the user task has requested you to do."
while read -r key email; do
  [ -z "$key" ] && continue
  aid=$(curl -sS -H "x-api-key: $key" "$URL/agents" | jq -r '.[] | select(.name=="app") | .id')
  [ -z "$aid" ] || [ "$aid" = "null" ] && { echo "$email: no app agent"; continue; }
  curl -sS -X PUT -H "x-api-key: $key" -H "Content-Type: application/json" \
    -d "{\"agentSettingsId\":\"$aid\",\"updates\":{\"systemMessage\":$(jq -Rn --arg s "$MSG" '$s')}}" \
    "$URL/agents/$aid/settings" > /dev/null
  echo "$email: ok"
done < dev_api_keys.txt
```

**Verify merged config (what the agent actually sees):**

```bash
while read -r key email; do
  [ -z "$key" ] && continue
  echo "=== $email ==="
  curl -sS -H "x-api-key: $key" "$URL/agents?name=app" \
    | jq '.[0] | {systemMessage, permissions: {allow: .permissions.allow, deny: .permissions.deny}}'
done < dev_api_keys.txt
```

**Known backend bug:** `GET /api/v1/agents/global` returns 500
(`Agent settings not found : agentSettingsId global`) because route
`/agents/{agentSettingsId}` is matched before `/agents/global`. `PUT
/agents/global` works fine (different path segment count). Verify via
`GET /agents?name=app` which returns merged view.

Relevant tool keys: `todoai_cloud:*` (browser_automation, intro, todoforai_api,
vault_access, business_context, image_gen, create_todo, update_agent_settings,
webfetch, google_search) and `todoai_edge:*` (READ, SEARCH, EXPLORE, REVIEW,
rclone, WRITE, UPDATE, BASH, CLI_INSTALLER, DOWNLOAD, PLAN).

## Failure categorisation (from 4.7 run, 35 failed / 89)

1. **Infra / task's own `test.sh` broke** — ~4 trials
   (`dna-assembly`, `merge-diff-arc-agi-task`, `model-extraction-relu-logits`,
   `adaptive-rejection-sampler`). Each `test.sh` does `apt-get install curl`
   then `curl https://astral.sh/uv/... | sh`. Two failure modes:
   - apt-get lock contention against our install script (race)
   - `releases.astral.sh` TCP timeout (network flake)
   Not an agent problem. Adapter-side workaround: pre-install `uv` in the base
   image (or `install-todoforai.sh.j2`) and ensure `apt-get` finishes before
   signalling ready.
2. **Agent produced no output file** — ~7 trials
   (`extract-moves-from-video`, `pytorch-model-recovery`, `regex-chess`,
   `extract-elf`, `feal-linear-cryptanalysis`, `caffe-cifar-10`,
   `compile-compcert`). Usually timeout / agent gave up.
3. **Agent produced wrong output** — ~18 trials (core agent quality).
   Examples: `chess-best-move` (missed one of two moves), polyglot tasks
   (extra build artefacts left in output dir — a cleanup prompt would fix),
   `gpt2-codegolf` (6426 B > 5000 B limit on 4.7, retry produced nothing),
   `prove-plus-comm` (Coq `Admitted` instead of `Qed`).
4. **Threshold/performance just under** — 2 trials
   (`largest-eigenval` 3% slow; `install-windows-3-11` image diff < 10%).
5. **Crash** — 1 trial (`torch-tensor-parallelism` multiprocessing spawn).

`make-doom-for-mips` / `make-mips-interpreter` consistently fail with
`TimeoutError: Timeout waiting for frame.bmp`. DOOM on MIPS seems out of reach
for both 4.6 and 4.7.

## Retry policy finding

Selective rerun on reward=0.0 is **not reliably helpful**. Evidence from the
5-task retry after the 4.7 sweep:

| Task | 4.7 first run | Retry |
|------|--------------:|------:|
| `merge-diff-arc-agi-task` | infra fail | ✅ PASS (infra flake resolved) |
| `dna-assembly` | infra fail | ❌ different fail (`primers.fasta` missing) |
| `model-extraction-relu-logits` | infra fail | ❌ matrix mismatch (agent wrong) |
| `gpt2-codegolf` | ❌ size 6426 > 5000 | ❌ file not even created |
| `adaptive-rejection-sampler` | infra fail | killed (other test was slow) |

Takeaway: agent runs are **non-deterministic**. Retry helps for infra-flakes,
rarely for agent-side errors, and can regress (gpt2-codegolf got worse).
Harbor's built-in `-k N` retries are only worth using if we report best-of-N.

## What needs to happen next

1. **Set `thinkingLevel` on the benchmark agent** before runs — the API keys
   (`dev_api_keys.txt`) point at user agents whose `thinkingLevel` defaults to
   none. For competitive benchmark runs set it to `high` (Claude Sonnet/Opus,
   GPT-5.x) or `xhigh` (Claude Opus 4.7, GPT-5.x) via the Agent Settings UI
   (cog icon next to LLM Model) or API:
   ```bash
   URL="https://api.todofor.ai/api/v1"
   LEVEL="high"
   while read -r key email; do
     [ -z "$key" ] && continue
     aid=$(curl -sS -H "x-api-key: $key" "$URL/agents?name=app" | jq -r '.[0].id')
     curl -sS -X PUT -H "x-api-key: $key" -H "Content-Type: application/json" \
       -d "{\"agentSettingsId\":\"$aid\",\"updates\":{\"thinkingLevel\":\"$LEVEL\"}}" \
       "$URL/agents/$aid/settings" > /dev/null
     echo "$email: set"
   done < dev_api_keys.txt
   ```
   Backend appends `(level)` to the model string at `prepareForAgent` —
   verify in agent logs that the model id arrives as e.g.
   `claude-opus-4.7(xhigh)`.

   **Known issue 2026-04-23:** PUT 200 OK but `GET /agents?name=app` and
   `GET /agents/<id>` both return `thinkingLevel: null` (and the field is
   missing entirely from `keys`). Either the GET serializer drops it, or the
   PUT silently no-ops. Verify by checking the agent payload at runtime: the
   model string should arrive as `claude-opus-4.6(high)`. If not, backend
   change is needed before relying on this.
2. **Write `model.json` into each job dir** on start — record `model`,
   `thinkingLevel`, API-key list, git commit of adapter/CLI/edge.
   `--job-name <model>__<ts>` is not enough: we want model ID queryable
   inside the dir. Add to the adapter's `setup()` or a wrapper script.
3. **`todoai_edge:REVIEW` is now denied globally** (applied to all 6 dev keys
   2026-04-23). Reasoning: `REVIEW` spawns a sub-agent for evaluation which
   doesn't help on benchmark tasks (no evaluator in the loop), burns tokens,
   and can confuse the main agent. Deny payload above includes it.
4. **Per-run results archive** — `benchmarks/results/` is currently empty and
   `terminal-bench/jobs/` is gitignored. Decide: do we commit aggregated
   result summaries (no trial logs) into `results/terminal-bench/<model>.json`
   for long-term comparison? Leaderboard-like.
5. **4.6 vs 4.7 model comparison report** — tabulate per-task winner; which
   tasks did 4.6 pass that 4.7 failed and vice versa. Put in
   `common/reporting/` as a small script.
6. **Auto-cleanup half-finished trial dirs on resume** — harbor doesn't
   currently rerun a trial dir that exists without `result.json`; adapter or a
   pre-resume script should `rm -rf` them.
7. **Pre-install `uv` in adapter install script** — would fix ~3-4 infra
   flakes per run. Task `test.sh` checks `command -v uv` before running the
   `curl astral.sh` bootstrap? Need to verify. If so, ship `uv` in the
   container from our side.
8. **Retry policy for known-flaky tasks** — add `-k 2` (n-attempts) or a
   selective rerun of `reward=0.0` trials after the full sweep (note: see
   "Retry policy finding" above — limited value).
9. **Backend hardening (separate concern):** reject unknown `agentSettings.id`
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
