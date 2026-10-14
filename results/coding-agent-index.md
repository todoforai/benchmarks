# Coding Agent Index (Artificial Analysis v1.5): other harnesses

Index = equal-weight mean of 3 benches, pass@1 averaged over 3 attempts per task.
Source: https://artificialanalysis.ai/agents/coding-agents (page JSON, pulled 2026-10-14),
methodology: https://artificialanalysis.ai/methodology/coding-agents-benchmarking

| Bench | Tasks | Harbor dataset | Scoring | Agent network |
|---|--:|---|---|---|
| DeepSWE v1.1 | 113 | `datacurve/deep-swe-1-1` (github datacurve-ai/deep-swe) | hidden tests in a separate verifier env, patch = `git diff base..HEAD` | **no-network** (API host only) |
| Terminal-Bench 4.0 | 66 | `terminal-bench/terminal-bench` @4.0.0 (`terminal-bench/tasks_tb4.txt`) | test suite + `harbor analyze` reward-hack judge | internet |
| SWE-Atlas QnA | 124 | `scale-ai/swe-atlas-qna` (github scaleapi/SWE-Atlas `data/qa`) | rubric LLM judge (Claude Opus 4.5), all items must pass; touching tracked files = fail | internet |

## Reason vs Codex vs Pi: same model (GPT-6 Astra xhigh), from Reason Machines' blog

Self-run by Reason (their Harbor Hub jobs). AA did not verify their runs. Codex row = public Harbor jobs.
Source: https://reasonmachines.com/blog/introducing-reason-agent-1-1 (Reason is built on Pi)

| Harness | Index | SWE-Atlas QnA | DeepSWE v1.1 | TB 4.0 | $/attempt |
|---|--:|--:|--:|--:|--:|
| Reason 1.1 | 65.1 (60.0–70.2) | 64.0 | 72.3 | 59.1 | 3.96 |
| Codex | 62.5 (57.5–67.5) | 60.5 | 69.0 | 57.9 | 4.89 |
| Pi | 61.4 (56.3–66.3) | 59.4 | 69.6 | 55.0 | 4.15 |

95% CIs overlap. Reason vs Codex: −2.7 index (−5.2 to −0.1), paired.

## AA leaderboard (all 39 rows, scores in %)

| Agent | Model | Index | DeepSWE 1.1 | TB 4.0 | SWE-Atlas QnA | $/task | wall min |
|---|---|--:|--:|--:|--:|--:|--:|
| Claude Code | Sonnet 5.5 (max) | 68.4 | 72.0 | 66.2 | 66.9 | 14.19 | 87 |
| Muse Code | Muse Wonder Full (max) | 68.0 | 77.0 | 59.1 | 68.0 | – | 29 |
| Claude Code | Opus 5.5 (max) | 66.0 | 68.4 | 63.1 | 66.4 | 13.04 | 64 |
| Antigravity CLI | Gemini 4 Argon | 63.8 | 78.8 | 56.1 | 56.5 | 5.84 | 35 |
| Muse Code | Muse Wonder (max) | 63.5 | 75.8 | 47.5 | 67.2 | 8.05 | 22 |
| Codex | GPT-6.1 Sol (xhigh) | 62.9 | 73.2 | 54.5 | 61.0 | 1.04 | 16 |
| Claude Code | Sonnet 5.5 (xhigh) | 62.9 | 68.4 | 58.1 | 62.1 | 3.33 | 27 |
| Claude Code | Fable 5.1 (max) (with fallback) | 62.2 | 64.3 | 57.6 | 64.8 | 12.39 | 35 |
| Devin Fusion CLI | Claude Fable 5.1 XHigh + SWE-2 Medium | 61.7 | 63.1 | 56.1 | 65.9 | 7.90 | 36 |
| Codex | GPT-6 Astra (max) | 61.6 | 67.6 | 55.6 | 61.8 | 7.47 | 29 |
| Codex | GPT-6.1 Sol (medium) | 61.4 | 72.0 | 51.5 | 60.8 | 0.70 | 11 |
| Codex | GPT-6.1 Sol (high) | 60.1 | 70.5 | 50.0 | 59.9 | 0.89 | 13 |
| Codex | GPT-6.1 Sol (max) | 60.1 | 69.6 | 53.0 | 57.8 | 1.55 | 24 |
| Claude Code | Opus 5 (max) | 59.7 | 62.5 | 54.5 | 62.1 | 10.79 | 42 |
| Devin Fusion CLI | GPT-6 Astra XHigh + SWE-2 Medium | 58.9 | 67.3 | 50.0 | 59.4 | 4.54 | 25 |
| Codex | GPT-6.1 Sol (low) | 57.2 | 67.6 | 49.0 | 55.1 | 0.50 | 9 |
| Codex | GPT-6 Sol (max) | 56.7 | 69.0 | 43.4 | 57.5 | 2.99 | 22 |
| Grok Build | Grok 4.7 (xhigh) | 56.3 | 72.6 | 33.3 | 62.9 | 8.82 | 39 |
| Claude Code | Sonnet 5.5 (high) | 55.0 | 66.7 | 41.9 | 56.5 | 1.24 | 12 |
| Codex | GPT-5.6 Sol (max) | 54.6 | 72.3 | 37.4 | 54.0 | 6.35 | 21 |
| Muse Code | Muse Spark 1.3 (max) | 54.3 | 71.7 | 31.8 | 59.4 | 3.98 | 18 |
| Opencode | GLM-5.3 | 53.6 | 61.4 | 39.9 | 59.4 | 4.24 | 48 |
| Kimi Code CLI | Kimi K3 | 51.9 | 68.4 | 21.2 | 66.1 | 5.05 | 61 |
| Claude Code | Step 5 Preview | 51.2 | 61.9 | 33.3 | 58.3 | 1.66 | 56 |
| Muse Code | Muse Spark 1.3 (xhigh) | 48.3 | 73.2 | 17.2 | 54.6 | 3.47 | 18 |
| Grok Build | Grok 4.6 (xhigh) | 47.0 | 64.9 | 17.7 | 58.3 | 3.57 | 19 |
| Claude Code | Sonnet 5.5 (medium) | 45.9 | 65.5 | 27.3 | 44.9 | 0.62 | 9 |
| Claude Code | Qwen3.8 Max | 43.3 | 51.0 | 16.7 | 62.1 | 3.48 | 63 |
| Codex | GPT-5.6 Luna (max) | 43.2 | 66.4 | 14.6 | 48.7 | 0.44 | 24 |
| Codex | DeepSeek V4 Pro 0813 (max) | 43.1 | 57.2 | 10.1 | 61.8 | 0.24 | 40 |
| Claude Code | Sonnet 5.5 (low) | 42.1 | 61.9 | 25.3 | 39.0 | 0.48 | 6 |
| Antigravity SDK | Gemini 3.8 Flash (high) | 41.9 | 65.8 | 14.6 | 45.2 | 2.47 | 12 |
| Claude Code | Haiku 5.5 (xhigh) | 41.4 | 49.0 | 23.7 | 51.6 | 0.61 | 26 |
| Codex | GPT-6 Luna (max) | 41.1 | 63.7 | 15.2 | 44.4 | 0.18 | 21 |
| Codex | DeepSeek V4 Flash 0731 (max) | 38.7 | 54.3 | 10.6 | 51.3 | 0.09 | 18 |
| Claude Code | Haiku 5.5 (max) | 36.5 | 46.0 | 29.8 | 33.6 | 2.58 | 87 |
| Claude Code | Haiku 5.5 (high) | 35.1 | 46.3 | 12.6 | 46.2 | 0.36 | 18 |
| Claude Code | Haiku 5.5 (medium) | 33.6 | 47.5 | 11.6 | 41.7 | 0.23 | 14 |
| Claude Code | Haiku 5.5 (low) | 28.2 | 45.4 | 6.1 | 33.1 | 0.14 | 12 |

$/task = pay-per-token list price incl. cache. Wall time = agent only (no env build or verifier).

## Running them with our harness (`terminal-bench/run.sh`, Harbor 0.22 on the WSL host)

All three are Harbor datasets, so the existing `todoforai_tbench` adapter applies as-is.

### Smoke 2026-10-14 (ours, Opus 5.5, `app` agent, k=1): both pass

| Bench | Task | Reward | Agent time | Command |
|---|---|--:|--:|---|
| DeepSWE v1.1 | abs-module-cache-flags | 1 (F2P 20/20, P2P 3/3) | 33 min | `./run.sh -m anthropic:anthropic/claude-opus-5.5 -d datacurve/deep-swe-1-1 -i abs-module-cache-flags -n 1 -- --allow-agent-host api.todofor.ai` |
| SWE-Atlas QnA | task-6905333b74f22949d97ba998 | 1 | 16 min | `harbor run -p ~/SWE-Atlas/data/qa -i task-6905333b74f22949d97ba998 -m anthropic:anthropic/claude-opus-5.5 -n 1 -k 1 -o jobs --agent-import-path todoforai_tbench:TODOforAIHarborAgent --env-file ~/qna-judge.env` |

Jobs (pc_2): `jobs/todoforai-claude-opus-5.5-app__2026-10-14__09-53-38`, `jobs/todoforai-claude-opus-5.5-app__qna-v1.1-smoke`.
Findings:
- The DeepSWE egress allowlist (Harbor docker sidecar) lets the backend through. The bridge works inside the no-network agent phase.
- **Do not use the Hub `scale-ai/swe-atlas-qna`**. It points at the old `swe-atlas:…_1.0` images, whose ENTRYPOINT is `/bin/bash`,
  so harbor's `sh -c "sleep infinity"` exits 126 and the trial dies. Use the GitHub `scaleapi/SWE-Atlas` `data/qa`
  (v1.1 images) with `-p`. AA also ran from a local path.
- QnA judge: `~/qna-judge.env` (WSL) = `OPENAI_API_KEY`=cliproxy client key, `OPENAI_API_BASE=http://172.17.0.1:8317/v1`,
  `EVAL_MODEL=claude-opus-4-5-20251101`. The cliproxy rejects the `anthropic/` prefix. Start the cliproxy first (`~/cliproxyapi`).
- The container has no git user, so the agent committed as "Claude Code <noreply@anthropic.com>". Harmless; consider setting a git identity in `setup()`.
- Full sweep estimate: 303 tasks × ~30 min / 4 concurrent ≈ 38 h per k. Agent timeout: Hub `deep-swe-1-1` = **5400 s (90 min)**, not 3 h.

### 5+5 run 2026-10-14 (Opus 5.5, `app`, k=1, n=2+2): DeepSWE 1/5, QnA 2/5

| Bench | Task | Reward | Detail | Agent time |
|---|---|--:|---|--:|
| DeepSWE | aiomonitor-task-snapshots-diff | 1 | F2P 53/53 | 26 min |
| DeepSWE | yaegi-go-embed-directives | 0 | AgentTimeout, no commit (F2P 0/38) | 90 |
| DeepSWE | ink-grid-box-layout | 0 | AgentTimeout, no commit (0/25) | 90 |
| DeepSWE | tengo-callable-instance-isolation | 0 | AgentTimeout, no commit (0/23) | 90 |
| DeepSWE | true-myth-iterable-collection-combinators | 0 | AgentTimeout, no commit (0/96) | 90 |
| QnA | …9cd / …a21 | 1 / 1 | 6/6, 11/11 rubrics | |
| QnA | …9b6 / …9eb / …9be | 0 | 8/10, 7/9, 10/12 rubrics | |

Timeouts, 2 kinds:
- **yaegi, ink: real timeouts.** Both were working until the kill (yaegi made 125 messages) but never committed.
- **tengo, true-myth: harness stall.** At about 12:37–12:38 CEST both todos stopped getting assistant output:
  an empty reply, or the reason block left PENDING. The CLI then sat idle until the kill. true-myth made only 18 tool calls,
  all in its first minute; tengo was idle for about 66 min. Probably a backend/LLM stream outage.
Needed: (1) a CLI no-progress watchdog (resend or fail fast); (2) a prompt or adapter step that commits WIP
early and often, since uncommitted work scores 0 and the 90 min limit is tight (AA: Claude Code averages about 64 min per task).
Re-run tengo and true-myth.

QnA misses: answers come after 2–8 min of exploration and skip exact constants (modifier bits, `Number.isFinite` paths)
and inline evidence. A QnA-specific prompt (exact values, every consumer, evidence inline) could help.
Jobs: `jobs/todoforai-claude-opus-5.5-app__2026-10-14__10-36-22`, `jobs/…__qna5__2026-10-14__10-36-22`.

Open points:

- **DeepSWE**: the agent phase is `no-network`. Our agent needs the backend (`api.todofor.ai`)
  → `--allow-agent-host api.todofor.ai`. Harbor's docker env has an egress allowlist, untested by us.
  Grading uses the separate verifier env + `[[verifier.collect]]`. Harbor 0.22 has it, so Pier
  is not needed. The instruction says "new branch, commit everything" (the patch is `git diff base..HEAD`),
  so uncommitted work scores 0.
- **SWE-Atlas QnA**: the answer must go in `/logs/agent/answer.txt` inside `<<FINAL_ANSWER>>`. The
  instruction says so; the agent writes it through the bridge. The judge needs `OPENAI_API_KEY` +
  `OPENAI_API_BASE` (OpenAI-compatible endpoint serving `anthropic/claude-opus-4-5-20251101`).
  Each task asks for 16 CPU / 16 GB, and the WSL host runs max 4 at once, so it will be slow.
- **TB 4.0**: already wired (`tasks_tb4*.txt`). AA also zeroes reward-hacked attempts (`harbor analyze`).
- Cost: 303 tasks × 3 attempts ≈ 900 trials per model. Run k=1 first.
- Not AA-verified either way. Comparable to the Reason row (self-run), not to AA rows.
