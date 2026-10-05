# TB 2.1 — Claude Code vs todoforai, Claude Opus 5.5

89 tasks, k=1, harbor 0.22.0, local Docker on WSL2 (pc_2).

| | Claude Code (reference) | todoforai (ours) |
|---|---|---|
| Job | `claude-code-claude-opus-5-5-high__2026-10-05__15-26-07` | `claude-opus-5.5-full__0926__batch01__2026-09-26__13-37-46` |
| Harness | Claude Code 2.1.289, default sysmsg, `bypassPermissions`, harbor `claude-code` agent unmodified | `todoforai-cli --isolated`, `app` agent |
| Model / effort | `claude-opus-5-5`, **high** | `claude-opus-5.5`, **xhigh** (runMeta) |
| Auth | Max subscription OAuth (`CLAUDE_CODE_OAUTH_TOKEN`), no API key | cliproxyapi, Claude OAuth (cloaked as Claude Code) |
| Concurrency | 4 | 10 |
| Wall time | 15:26 → 19:18 (3 h 52 m) | — |
| **Pass** | **78/89 (87.6%)** | **72/89 (80.9%)** |
| Cost at list price | $37.4 (harbor `cost_usd`) | $64.4 (`scripts/run_tokens.mjs`) |

**Not like-for-like:** effort (high vs xhigh), concurrency (4 vs 10), date (10-05 vs 09-26),
sysmsg (global default changed 10-01), and the refusal fallback below. Treat the gap as indicative.

## Refusal fallback (largest single difference)
On an Opus 5.5 refusal (`stop_reason: refusal`, category `bio`/`cyber`), Claude Code silently
retries the session on **claude-opus-4-8** (`system/model_refusal_fallback` in `agent/claude-code.txt`).
Our agent stops with an error (0926: classified `ApiError`; now `AgentSafetyRefusalError`).

| Task | CC (via Opus 4.8) | Ours 0926 | Ours, Opus 4.8 rerun (`todoforai-claude-opus-4.8-app__2026-10-05__16-38-47`) |
|---|---|---|---|
| break-filter-js-from-html | 1 | 0 refusal | 0 (Opus 4.8 refused too) |
| crack-7z-hash | 1 | 0 refusal | — |
| password-recovery | 1 | 0 refusal | — |
| vulnerable-secret | 1 | 0 refusal | — |
| dna-assembly | 0 | 0 refusal | **1** |
| dna-insert | 0 | 0 refusal | 0 |
| protein-assembly | 0 (Opus 4.8 refused too) | 0 refusal | — |

`filter-js-from-html`: refused in 0926, but in the CC run Opus 5.5 answered (no fallback) and passed → refusals are not deterministic.
Verified directly through local cliproxy: the dna-assembly `task.md` alone (no sysmsg, no tools) is refused 2/2 by Opus 5.5 and accepted 2/2 by Opus 4.8. Our sysmsg is not the trigger.

Opus 4.8 share of CC output tokens: 0.10M of 0.68M ($5.0 of $33.1 in result lines).

## Adjusted numbers
- CC pure Opus 5.5 (fallback passes counted 0): 78 − 4 = **74/89 (83.1%)**.
- CC infra failures: `qemu-alpine-ssh`, `qemu-startup` — harbor's Claude Code install (`apt-get install nodejs npm`) got 404 on the bullseye security mirror; agent never started. Both pass in our run. Infra-excluded: 78/87 (89.7%), pure Opus 5.5 74/87.
- Ours with the Opus 4.8 refusal reruns merged: 72 + 1 (dna-assembly) = 73/89 (only 4 of the 8 refused tasks rerun).

## Per-task differences (pass in one only)
| Task | CC | Ours |
|---|---|---|
| adaptive-rejection-sampler | 1 | 0 timeout |
| cobol-modernization | 1 | 0 timeout |
| query-optimize | 1 | 0 timeout |
| schemelike-metacircular-eval | 1 | 0 timeout |
| polyglot-c-py | 1 | 0 |
| break-filter-js-from-html, crack-7z-hash, password-recovery, vulnerable-secret | 1 (Opus 4.8) | 0 refusal |
| filter-js-from-html | 1 | 0 refusal |
| compile-compcert | 0 | 1 |
| configure-git-webserver | 0 | 1 |
| train-fasttext | 0 timeout | 1 |
| video-processing | 0 | 1 |
| qemu-alpine-ssh, qemu-startup | infra (not run) | 1 |

Ours lost 6 tasks to `AgentTimeoutError` (CC: 3). 4 of those 6 pass under CC — xhigh vs high likely contributes (unverified).

## Next
- Rerun ours at **high**, concurrency 4, same sysmsg as now, for a like-for-like number.
- Refusal → Opus 4.8 fallback in our agent (product decision; would match CC behaviour).
- Rerun the 2 qemu tasks for CC with a working apt mirror.
