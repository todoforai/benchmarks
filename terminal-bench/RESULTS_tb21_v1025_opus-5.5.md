# TB 2.1 full 89 — todoforai v1.0.25, bash + tfa-cat, Opus 5.5 high, k=1

**82/89 (92.1%)**, $51.46 list, single sweep, no reruns. Previous: 81/89 (v1.0.11, 10-25/26, $50.82).

| batch | pass | cost | job |
|---|---|---|---|
| 1–20 | 19/20 | $8.99 | `todoforai-claude-opus-5.5-app__2026-11-14__14-20-52` |
| 21–40 | 16/20 | $13.36 | `…__2026-11-14__16-30-14` |
| 41–89 | 47/49 | $29.11 | `…__2026-11-16__10-08-48` |

Setup: bridge v1.5.86, CLI 0.1.72 (Windows host, WSL docker), bench agent `app` = Opus 5.5 high, one tool (`bash`),
Opus 4.8 refusal fallback. Agent `9bc39700` for 1–40, `bd81e338` for 41–89 (adds `refusalRetryEvery`, left **off**).
Backend deploys 11-14 16:50 and 11-16 11:54/11:57 (CET) hit no trial (`Server restarting` in no edge log).

## The 7 fails
| task | why | v1.0.11 |
|---|---|---|
| cobol-modernization | AgentTimeoutError | 1 |
| extract-moves-from-video | AgentTimeoutError | 0 |
| filter-js-from-html | AgentTimeoutError | 1 |
| make-doom-for-mips | AgentTimeoutError — all harnesses time out | 0 |
| dna-assembly | wrong (4.8 fallback after refusal) | 0 |
| dna-insert | wrong (4.8 fallback after refusal) | 0 |
| video-processing | wrong — never passed by any harness | 0 |

New passes vs v1.0.11: model-extraction-relu-logits, torch-tensor-parallelism (both verifier timeouts then),
financial-document-processor. Lost: cobol-modernization, filter-js-from-html (both timeouts).

## Served model
Same 7 tasks hit the 4.8 fallback as in v1.0.11: break-filter-js ✓, crack-7z-hash ✓, password-recovery ✓,
protein-assembly ✓, vulnerable-secret ✓, dna-assembly ✗, dna-insert ✗. Pure 5.5 = 77/82.

## Medium (thinkingLevel=medium), same 89 tasks, k=1
**83/89 (93.3%), $33.88** vs high 82/89, $51.46 (−34% cost). Within k=1 noise (σ≈3 tasks).

| part | pass | cost | job |
|---|---|---|---|
| first 40 | 38/40 | $13.16 | `…-app-medium__2026-11-15__19-50-33` (its 3 first-40 tasks) + `…__21-05-53` (37) |
| make-doom, schemelike, qemu-alpine-ssh | 2/3 | $5.42 | `…-app-medium__2026-11-15__19-50-33` |
| 9 clean passes of the 11-16 11:48 attempt | 9/9 | $1.66 | `…-app-medium__2026-11-16__11-48-40` |
| remaining 37 | 34/37 | $13.64 | `…-app-medium__2026-11-16__12-15-05` |

The 11:48 attempt died on a full C: (WSL ext4 read-only): its 4 broken trials (mteb-leaderboard, regex-chess,
torch-pipeline-parallelism: no reward; pytorch-model-recovery: verifier Bus error) are infra, rerun in the 37, all 4 passed.
Backend deploys 12:55/13:01/13:32 and agent deploy 13:09 (local) made 4 trials reconnect (modernize-scientific-stack ✓,
winning-avg-corewars ✓, train-fasttext ✓, protein-assembly ✗); each kept working after the reconnect.

Medium fails (6): make-doom-for-mips (timeout), video-processing, dna-insert (4.8 fallback), filter-js-from-html
(modified 3/12 clean files), mteb-retrieve (retrieved HumanEval instead of MTEB), protein-assembly (fusion order /
donor missing; FPbase fetches 403). The last two pass at high. Medium passes that high failed: cobol-modernization,
extract-moves-from-video, dna-assembly.
