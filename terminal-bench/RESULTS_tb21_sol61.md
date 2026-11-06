# TB 2.1 full (89) — todoforai bash + tfa-cat, GPT-6.1 Sol high vs Opus 5.5 high, k=1

| | Sol 6.1 (no fallback) | Opus 5.5 (+4.8 refusal fallback) |
|---|---|---|
| pass | **76/89 (85.4%)** | **81/89 (91.0%)** |
| pure model (no fallback) | 76/89 | 76/82 non-fallback tasks (+0 from fallback-free) = 76 |
| cost (list) | **$8.63** | **$50.82** |
| calls / output tokens | 925 / 383k | 1373 / 1442k |
| input (fresh / cacheR / cacheW) | 1949k / 9022k / 0 | 2k / 12152k / 1389k |

Prices $/1M (in/out/cacheR/cacheW): Sol 2/10/0.10/2.50 (openai.com list), Opus 5/25/0.5/6.25.
Opus = `RESULTS_tb21_tfacat_opus-5.5.md` (10-25/26). Per-task table: `node scripts/tokcmp.mjs`
(output kept in `jobs/tokcmp89.md`). Best result per task across the Sol jobs (`jobs/aggregate89.mjs`).

**Not apples to apples:** Opus had the 4.8 refusal fallback (7 tasks, 5 ✓). Sol ran pure.
Pure-model: Sol 76 = Opus 76. Sol is ~6× cheaper, ~3.8× fewer output tokens.

## Jobs (`jobs/todoforai-gpt-6.1-sol-app-sol__…`)
| job | content |
|---|---|
| 2026-11-05__13-40-57 | cancelled full89, 7 finished (CancelledError ones dropped) |
| 2026-11-05__14-55-27 | tasks 1–20 |
| 2026-11-05__15-26-40 | tasks 21–40 (−2 done) |
| 2026-11-06__14-25-47 | rest44 — 12 valid; rest wrecked (backend outage 14:45, ChatGPT quota `model_overloaded`) |
| 2026-11-06__15-26-11 | overfull-hbox smoke |
| 2026-11-06__15-30-49 | rest31 (re-ran the wrecked ones) |
| 2026-11-06__16-32-06 | infra rerun: vulnerable-secret |

All jobs: served model verified `gpt-6.1-sol(high)` (`scripts/verify_model.sh`).
Bridge: `todoforai_tbench/dist/todoforai-bridge` v1.5.71 (CLI 0.1.29) for all runs, including the rerun.
Backend deploys fell inside the 11-06 runs (13:50, 14:17, 15:35); infra zeroes were rerun once,
rerun result overrides. Real fails, refusals, AgentTimeoutError not rerun.

## Sol fails (13)
| task | cause | Opus |
|---|---|---|
| break-filter-js-from-html | **OpenAI refusal** (HTTP 400 cyber, pre-fix → logged ApiError) | ✓ (4.8 fallback) |
| model-extraction-relu-logits | **refusal** (`AgentSafetyRefusalError`, flagged cyber) | ✗ |
| vulnerable-secret | stream EOFError, 2× at the same point (binary RE) — rerun once, same; suspected silent cyber cut, *unconfirmed* | ✓ (4.8 fallback) |
| make-doom-for-mips | AgentTimeoutError | ✗ |
| train-fasttext | AgentTimeoutError | ✓ |
| chess-best-move, configure-git-webserver, extract-elf, filter-js-from-html, install-windows-3.11, mteb-retrieve, sanitize-git-repo, torch-pipeline-parallelism | wrong / partial | ✓ |

## Sol only (Opus ✗)
dna-assembly, dna-insert, torch-tensor-parallelism (Opus verifier timeout), extract-moves-from-video,
financial-document-processor, video-processing.
Sol also solved (no refusal) crack-7z-hash, password-recovery, protein-assembly — Opus only via 4.8 fallback.

## Refusals
OpenAI refuses with HTTP 400 "flagged for possible cybersecurity risk". Fixed → `ModelRefusalError`
(OpenRouter.jl `cdaa378`, agent deploy 11-05 20:56; harness `_REFUSAL_RE` `6300436`).
`app-sol` has no `refusalFallbackModel`; adding one (e.g. Opus) would likely recover 2–3 tasks.

## Open
- Backend catalog prices Sol at 1/5 $/1M = half of list → check billing.
