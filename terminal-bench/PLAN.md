# Terminal-Bench: making TODOforAI a first-class benchmarkable agent

Status: TB3 not released (call for contributions, Mar 2026; `terminal-bench/terminal-bench-3` → 404,
HF `terminal-bench-3.0-lfs` empty). Latest shipped is 2.1. **TB3 = TB2 with a dataset-id swap.**
Everything below is what we need regardless of which dataset id we point at.

Reference implementations live in our venv and were read directly:
`.venv/lib/python3.13/site-packages/harbor/agents/installed/{claude_code,codex,acp}.py`.

---

## 1. How claude-code / codex are actually run

```bash
# claude_code.py:1770-1783 — instruction via env var → shell var → stdin, never argv
printf "%s" "$INSTR" | claude --verbose --output-format=stream-json \
    --settings /tmp/claude-code-settings/settings.json \
    --permission-mode=bypassPermissions --print 2>&1 | tee /logs/agent/claude-code.txt

# codex.py — same shape
codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check \
    --model $M --json --enable unified_exec -- "$INSTR" 2>&1 </dev/null | tee ...
```

Env for claude: `ANTHROPIC_MODEL` (+ sonnet/opus/haiku/subagent aliases), `IS_SANDBOX=1`,
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, `CLAUDE_CONFIG_DIR=<agent_dir>/sessions`.

Both then convert their **native session JSONL** →
**ATIF** (`Trajectory`/`Step`/`ToolCall`/`Observation`, schema `ATIF-v1.7`) in
`populate_context_post_run()`, write `trajectory.json`, and push cost + token counts into
harbor's `AgentContext`.

## 2. The six contracts, and where we stand

| Contract | claude-code / codex | `todoforai` today |
|---|---|---|
| One-shot non-interactive | `--print` / `codex exec` | ✅ `--non-interactive` |
| Bypass approvals | `--permission-mode=bypassPermissions`, `IS_SANDBOX=1` | ✅ `--allow-all` |
| Model from harness | `-m` → `ANTHROPIC_MODEL` / `--model` | ⚠️ `--model` exists but bench uses account config, hand-provisioned by curl |
| Machine-readable stream | `--output-format=stream-json`, `--json` | ❌ `--json` is plumbed but `watch.ts` ignores it; ANSI prose to stderr |
| Session file → ATIF | native JSONL → `trajectory.json` | ❌ `populate_context_post_run` is `pass`; `artifacts/` empty |
| **Exit code = outcome** | non-zero + `ERROR_PATTERNS` classify API errors | ❌ **exits 0 on ERROR** |

### The exit-code bug is the expensive one

`cli/src/watch.ts:319-322` prints `Warning: Stopped: ERROR` and `return true`. Nothing sets an
exit code. Observed tonight: the Julia agent died with
`503 auth_unavailable (providers=claude, model=claude-opus-4-7)` and harbor recorded
**0 exceptions, reward 0.0** — indistinguishable from "agent tried and failed".

With claude-code the string `API Error` hits `BaseInstalledAgent.ERROR_PATTERNS`
(base.py:441-515) → `UnknownApiError` / `ApiRateLimitError` / `ContextWindowExceededError` →
harbor marks it an **exception**, excluded from the score.

**Every number we have published silently includes infra failures as agent failures.**

---

## 3. Target CLI surface

Not a bench mode — the same flags a normal user gets.

```
todoforai-cli --print "task"              # one-shot; stdin-safe alias of -n
    --output-format stream-json           # NDJSON stdout: assistant/tool_call/tool_result/result
    --model anthropic:.../claude-opus-5   # exists; must WIN over account config
    --session-dir <dir>                   # writes <session-id>.jsonl (native transcript)
    --resume <session-id> | --continue
exit 0 = completed | 1 = agent error | 2 = infra/auth/LLM error
```

Value beyond the benchmark: NDJSON makes the CLI scriptable in CI; the session file makes runs
auditable and resumable; correct exit codes make it composable in pipelines. TB just demands all
three at once.

## 4. Adapter work (`todoforai_tbench/harbor_agent.py`)

1. `MODEL_CONNECTION` + accept harbor `-m` → pass as `--model`. A run becomes fully described by
   the harbor command; no per-account curl, no ambiguous attribution.
2. `populate_context_post_run()` → parse session JSONL → ATIF → `trajectory.json` + cost/tokens.
   **ATIF is mandatory for leaderboard submission** — without it we cannot submit at all.
3. `ERROR_PATTERNS` for our surface: `auth_unavailable`, `Agent '<x>' not found`,
   `API key invalid`, edge/bridge disconnect, WS drop.
4. `SUPPORTS_ATIF` / `SUPPORTS_RESUME` once 1–2 land.
5. Replace `sleep 5` with a device-readiness poll; `tee` everything to `/logs/agent/`.
6. Instruction via env var → stdin (no argv quoting/length risk).
7. `bench.toml` in-repo (api_url, model, agent name, system message, permissions) applied
   idempotently at job start — replaces the four curl loops in NEXT.md.
8. Fail-fast preflight per key: `GET /agents` 200 + agent exists + one cheap LLM roundtrip.
   Seconds spent; saves 2-hour zero-scoring jobs.

## 5. Leaderboard rules (verified)

`metadata.yaml` (agent_url, display names, model list) + full job dirs; **min 5 trials/task
(`-k 5`)**; `timeout_multiplier=1.0`; no agent/verifier timeout or CPU/memory overrides; ATIF on
all passing trials; an agent judge scans passers for reward hacking; agents must not reach the
tbench site/GitHub. Our cloud-tool deny-list already satisfies the last one — now also a
compliance requirement, keep it.

---

## 6. Naming safety: keep `todoai` contracts until a staged migration exists

The product brand, package scope, and repository names legitimately use `TODOforAI` / `todoforai`,
but the currently shipped CLI command is `todoai` and persisted keys include `todoai_edge` and
`todoai_cloud`. Do not mechanically replace these contracts.

Any future rename must be handled as separate, reviewed migrations:

1. Add a new CLI alias while retaining `todoai` for backward compatibility.
2. Rename internal identifiers only where they are not serialized or externally consumed.
3. Change persisted config and permission keys only through read-both/write-old compatibility,
   followed by a separately approved, record-by-record migration and verification.

Never combine command, internal-identifier, persisted-key, or edge-to-bridge changes in one commit.

## 7. Bridge instead of edge in the container

**Yes, and it's the better target.** Sizes measured today:

| | binary | notes |
|---|---:|---|
| `todoforai-edge` (bun) | **91 MB** | bun runtime embedded |
| `todoforai-bridge` (C) | **142 KB** | ~640× smaller, static musl available (`make static`) |

Every trial currently uploads and installs 91 MB into a fresh container. 142 KB is free.

**Tool execution over bridge already works.** `agent/src/datasource/edge/transport.jl` implements
the full verb set for `BridgeTransport` (device_type `BRIDGE`):
`t_exec` → `_machine_exec`, `t_read` → `write_file_b64`/b64 read, `t_write` → `write_file_b64`,
`t_grep` → `rg`/`grep` fallback, `t_list` → `ls -1Ap`. `std_flow.jl:242` routes bridge devices via
`BridgeHandler`, real edges via native `edge_call` — decided at the leaf by `is_bridge_edge`.
So the agent does not care which one is in the container.

**Gaps and how each is handled:**

| Gap | Resolution |
|---|---|
| No `--add-path` | Not needed. Bridge cwd comes from the agent's `devicesConfig`; set it via `PUT /api/v1/agents/{id}/device-config` with `{workspacePaths:["/app"]}`. Cleaner than a CLI flag — it's the same REST call the bench profile already makes. |
| No `--api-key` / `--api-url` | Bridge uses device enrollment: `POST /api/v1/cli/enroll/mint` (verified working, returns token) → `todoforai-bridge login --token <t> --host <h> --port <p>`. Fits the per-trial key pool: mint one token per trial from the trial's API key. |
| No MCP | Irrelevant for terminal tasks; the bench deny-list already disables cloud tools. |
| Noise/TOFU | **Risk.** `login --token` against the local backend failed with `Noise handshake failed / server identity changed`. Must be root-caused before switching — a fresh container has no TOFU state, which is the common case and should be the easy one. |
| Naming | `--device-name` accepts only letters/numbers/underscores (hit this: `tb-smoke` rejected, `tb_smoke` fine). |

**Second-order win:** bridge is the same daemon a real user runs on their PC, so the bench measures
the shipped path instead of a bench-only one.

---

## 8. Order of work

1. **Exit codes + `ERROR_PATTERNS`** — stops silent zeros; makes every existing and future number
   trustworthy. Contained, no protocol change.
2. **`--output-format stream-json` + session file → ATIF export** — unlocks diagnosis and is a hard
   requirement for submission.
3. **`--model` passthrough + `bench.toml` + preflight**; re-baseline TB2.
4. **Bridge-in-container** (behind an adapter switch; A/B against edge on the same task set).
5. **Rename (a)/(b)**; (c) with migration.
6. **TB3**: swap dataset id, refresh `tasks_all.txt`, `-k 5`, `metadata.yaml`, submit.

## Fixed already this session

- `.venv` with pinned harbor 0.21 + editable adapter (global harbor had drifted; adapter targeted
  the 0.1.45 API and failed to import).
- `run_single.sh` / `scripts/run_batches.sh` pointed at a deleted
  `~/.todoforai/tools/venv/bin/harbor` → now the repo `.venv`.
- Rebuilt `todoforai` / `todoforai-edge` dist binaries.
- Root-caused the 401s: shell `TODOFORAI_API_URL` overrides `.env` (dotenv does not override), and
  `dev_api_keys.txt` only exists on the local backend. Config precedence needs to be explicit and
  printed by the preflight.
