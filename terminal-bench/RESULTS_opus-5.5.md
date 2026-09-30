# Terminal-Bench 2.1 — claude-opus-5.5, 2026-09-26/30

FINAL: 77/89 = 86.5%  (last attempt per task)

Sweep: `claude-opus-5.5-full__0926` (xhigh, 89 tasks), then reruns:
`high-timeouts__0928` (high, 6 timed-out tasks), `polyglot-debfe__0929`
(polyglot-c-py after DEBIAN_FRONTEND harness fix c2166ff), `rerun3-cpu__0930`
(qemu-startup + extract-moves, bridge v1.5.53, cpu fix 695e674, curl verifier fix 2b6b6b4) and
`alpine-eolsec__0930` (qemu-alpine-ssh, verifier fix fa3234d). Final = last run of each task.

Same harness as the Sol 82.0% result (`RESULTS_tb2-clean-win_gpt-5.6-sol-xhigh.md`):
bash + read + webfetch, `--isolated` mayfly bridge, no review sub-agent.

## Failures (12)
**Safety-classifier refusals — 8** (Anthropic flags the task, todo stops after 1-2
calls, harbor records `ApiError`). Not retried: they refuse again (LESSONS.md).
| task | flag |
|---|---|
| dna-assembly, dna-insert, protein-assembly | bio |
| break-filter-js-from-html, filter-js-from-html, crack-7z-hash, password-recovery, vulnerable-secret | cyber |

**Real fails — 4**
| task | cause | last run |
|---|---|---|
| schemelike-metacircular-eval | AgentTimeoutError, LLM-bound (long thinking turns) | high-timeouts__0928 |
| make-doom-for-mips | AgentTimeoutError | high-timeouts__0928 |
| extract-moves-from-video | AgentTimeoutError: OCR of 951 frames on 1 CPU (0928 also thrashed: `xargs -P $(nproc)`=64) | rerun3-cpu__0930 |
| query-optimize | wrong answer | high-timeouts__0928 |

**qemu-startup / qemu-alpine-ssh were verifier failures, not agent ones**: their
test.sh (debian:bullseye-slim) `apt-get install curl expect|sshpass` 404s on the EOL
bullseye-security pool → no curl/uvx/sshpass → reward 0 regardless of the agent, on
every Opus 5.5 run (09-25..30). The agent had solved both. With the harness fix
(fa3234d: drop bullseye-security after the agent, before the verifier) both pass.

Excluding refusals: 77/81 = 95.1% of the tasks Opus 5.5 is allowed to attempt.

## Cost
List price = opus-5 ($5 in / $25 out / $0.5 cacheRead / $6.25 cacheWrite per 1M),
`scripts/run_tokens.mjs`:
| run | tasks | $ | $/task |
|---|---:|---:|---:|
| full__0926 sweep | 89 | 64.38 | 0.72 |
| high-timeouts__0928 | 6 | 12.18 | 2.03 |
| polyglot-debfe__0929 | 1 | 0.19 | 0.19 |
Sweep + reruns = $76.75 (upper bound; the 7 sweep attempts later superseded by a rerun
are still counted). Output tokens are 75 % of the cost (thinking).
vs Sol xhigh: $31.67 for 82.0 %.

Wall-time anatomy of the long trials: `RESULTS_long_runs_0929.md`.
