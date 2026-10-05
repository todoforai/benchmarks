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

## Like-for-like rerun: ours at high (10-05)
Job `todoforai-claude-opus-5.5-app__2026-10-05__22-21-25` (`./run.sh -m anthropic:anthropic/claude-opus-5.5 -t tasks_all.txt -n 4`),
runMeta `claude-opus-5.5(high)`, concurrency 4, sysmsg = `app` one-liner + current default global. 22:21 → 00:53 (2 h 31 m).

| | CC (high) | Ours high | Ours 0926 xhigh |
|---|---|---|---|
| Pass | 78/89 | **71/89 (79.8%)** | 72/89 |
| Pure Opus 5.5 (no fallback passes) | 74/89 | 71/89 | 72/89 |
| Excl. qemu infra (CC never started) | 74/87 | 69/87 | — |
| Refusals (`AgentSafetyRefusalError`) | 7 → fell back to 4.8 | 7 | 8 |
| `AgentTimeoutError` | 3 | 5 | 6 |
| Cost, list price | $37.4 | **$31.8** ($0.36/task) | $64.4 |

xhigh → high: −1 task, half the cost. Refusals hit the same 7 tasks as CC's fallbacks (break-filter-js-from-html,
crack-7z-hash, dna-assembly, dna-insert, password-recovery, protein-assembly, vulnerable-secret).

Pass in one only (excluding the 4 fallback passes and qemu infra):
| Task | CC | Ours high | Ours 0926 |
|---|---|---|---|
| cobol-modernization | 1 | 0 timeout | 0 timeout |
| schemelike-metacircular-eval | 1 | 0 timeout | 0 timeout |
| query-optimize | 1 | 0 | 0 timeout |
| filter-js-from-html | 1 | 0 | 0 refusal |
| mteb-retrieve | 1 | 0 | 1 |
| overfull-hbox | 1 | 0 | 1 |
| train-fasttext | 0 timeout | 1 | 1 |

Net genuine gap vs pure CC: 5 tasks on 87; 2 are consistent timeouts (cobol, schemelike — slower harness, not effort),
2 are noise-level (mteb-retrieve, overfull-hbox passed in 0926). With a 4.8 refusal fallback ours would gain up to 4–5
(CC got 4 via fallback; our 4.8 rerun also got dna-assembly).

## Next
- Refusal → Opus 4.8 fallback in our agent (decided: agent-side, hidden, sticky for the todo; runMeta.model shows 4.8).
- Look at cobol-modernization / schemelike-metacircular-eval timeouts (both harnesses same model; CC finishes in time).
- Rerun the 2 qemu tasks for CC with a working apt mirror.
