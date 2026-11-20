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

## Follow-ups on the 13 Sol 6.1 fails (2026-11-17/18, Windows WSL, k=1 each)
Same harness and `app-sol` agent; only the model / thinking level changed. Cost = tokens x list ($2/$10/$0.10 per M).

| job (`jobs/todoforai-…`) | model | tasks | pass | cost |
|---|---|---|---|---|
| gpt-6.1-sol-app-sol-xhigh__2026-11-17__17-02-00 | 6.1 Sol xhigh | 13 fails | 5: break-filter-js-from-html, chess-best-move, sanitize-git-repo, train-fasttext, vulnerable-secret | ~$4.35 |
| gpt-6.2-sol-app-sol-high__2026-11-17__20-56-18 | 6.2 Sol high | 13 fails | 3: chess-best-move, train-fasttext, vulnerable-secret | $3.90 |
| gpt-6.2-sol-app-sol-xhigh__2026-11-17__22-14-49 | 6.2 Sol xhigh | 10 still failing | 1: install-windows-3.11 | $3.85 |
| gpt-6.2-sol-app-sol-high-rerun__2026-11-18__12-01-14 | 6.2 Sol high | 13 fails | 4: chess-best-move, torch-pipeline-parallelism, train-fasttext, vulnerable-secret | $4.12 |

Served model verified on every job (`scripts/verify_model.sh`); no ApiError / NetworkConnectionError.
The 6.2 high first run overlapped a backend outage; the rerun (outage-free) gave 4 vs 3, the only
difference being torch-pipeline-parallelism (verifier timeout first, pass on rerun). So the outage
did not explain the 6.2 fails.

**Composite, best result per task (NOT a clean k=1 score; failures got 2–3 extra attempts):**
- Sol 6.1: 76 (high) + 5 (xhigh) = **81/89**
- Sol 6.2: 76 (6.1 high passes, not re-run on 6.2) + 5 (chess, train-fasttext, vulnerable-secret,
  install-windows-3.11, torch-pipeline-parallelism) = **81/89** (82 after hard-40 xhigh, below)

Still failing on 6.2 after all attempts: model-extraction-relu-logits (`AgentSafetyRefusalError` every
time), break-filter-js-from-html (advice only, no files changed), mteb-retrieve, configure-git-webserver,
extract-elf, filter-js-from-html, make-doom-for-mips, sanitize-git-repo (6.1 xhigh solved it).

Not done: a clean full-89 Sol 6.2 run; the 6.1 xhigh re-check of the 20 high passes
(`…xhigh__2026-11-17__19-41-32`) was wrecked by a Windows crash (NonZeroAgentExitCode, 2 cancelled) — unusable.


## Hard-40, Sol 6.2 xhigh: todoforai vs Codex CLI (2026-11-19/20, Windows WSL, k=1)
40 tasks = TB 2.1 tasks with the highest fail rate across all our earlier jobs (`tasks_hard40.txt`).
Both via `gpt-6.2-sol` xhigh; Codex through the local cliproxy fork (Codex OAuth, `codex_sol.toml`).

| harness | job(s) | pass | cost |
|---|---|---|---|
| todoforai | `todoforai-gpt-6.2-sol-app-sol-xhigh-hard40__2026-11-19__12-50-35` | **27/40** | $12.72 |
| Codex CLI | `codex-gpt-6.2-sol-xhigh-hard40{,-rest36,-retry2}__…` | **26/38** | $12.10 |

- Codex could not run qemu-alpine-ssh, qemu-startup: its installer needs nodejs from bullseye-security,
  which now 404s (harness problem, not model). Excluded; on the 38 comparable tasks: **todoforai 26 = Codex 26**.
- Differ: todoforai only raman-fitting, torch-pipeline-parallelism; Codex only extract-moves-from-video, train-fasttext.
- Both fail: configure-git-webserver, extract-elf, filter-js-from-html, make-doom-for-mips, mteb-retrieve,
  query-optimize, sanitize-git-repo, video-processing; both refuse break-filter-js-from-html, vulnerable-secret.
- C: filled up mid Codex run (WSL vhdx 153 GB): 5 trials lost, rerun as `-rest36`; 2 setup timeouts after
  the image re-pull rerun as `-retry2` (both passed). Cost includes the lost trials.
- xhigh vs high (ours): xhigh newly solved model-extraction-relu-logits (never solved before) but missed 4
  tasks high had solved (extract-moves-from-video, qemu-alpine-ssh, query-optimize, video-processing) — noise.
- Sol 6.2 composite (best per task) is now **82/89** (+ model-extraction-relu-logits).

## Open
- Backend catalog prices Sol at 1/5 $/1M = half of list → check billing.
