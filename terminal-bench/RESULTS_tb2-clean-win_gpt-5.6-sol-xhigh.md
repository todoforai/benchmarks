# Terminal-Bench 2.1 — gpt-5.6-sol (xhigh), review OFF, sysmsg diet — 2026-09-02/03

FINAL: 73/89 = 82.0%, $31.67   (baseline tb21 with review sub-agent: 73/89 = 82.0%, $141.43)
(71/89 before tb2-rerun3; +install-windows-3.11 +torch-pipeline-parallelism after the mayfly token TTL fix)
`python3 scripts/final_stats.py` recomputes the verdict from jobs/ (last intended attempt per task).

Sweep: tb2-clean-win__0901-1800 (batches 1-9, Windows/WSL, 5 concurrent) +
tb2-rerun1__0902 (7 infra victims, 10 conc) + tb2-rerun2__0902 (5 batch-9 tasks I
killed by starting rerun1 in parallel — run_batches.sh prunes all containers) +
tb2-visual__0903 (3 image tasks after ReadTool description fix) +
tb2-rerun3__0904 (8 harness-timeout tasks after mayfly token TTL 15 min → 6 h).
Final = last rerun result where one exists.

## What the 82% rests on (the shipped "Terminal-Bench 82%" agent template)
- Sol xhigh; same harness got 60.7 % with Opus 4.7, 47.2 % with Opus 4.6 → model is factor #1
- narrow tool set: bash + read + webfetch, 16 deny patterns (question, explore, review,
  skill, html_snippet, todoforai_api, image_gen, WRITE/UPDATE/SEARCH/LIST, …). Fewer
  schemas in context = less noise per turn; review/explore sub-agents added cost, not score
- never blocks on the user (`question` denied), 600 s stream timeout, `--isolated`
  mayfly bridge = one clean device, no browser/extension/multi-device context
- sysmsg diet 7.4k → 1.0k tokens: cost only, score unchanged (tb21 == tb2)
- `read` was never called by any trial — bash/cat does it all

## What changed vs tb21
- review tool denied (was opus-5, $72 of the $134 baseline)
- sysmsg diet: ~7.4k → ~1.0k tokens first call (bash identity into tool label,
  solo-machine section skipped, resource-access gated)
- ReadTool enabled from batch 5 (was `*:READ` denied); `read` was never called
  by any trial anyway — the model reaches for bash/ffmpeg/OCR by reflex
- infra: nginx 10→50 r/s per IP; first-chunk stream timeout 120→600 s;
  adapter `--path "$PWD"` (prove-plus-comm uses /workspace)

## Delta vs tb21 (same 89 tasks)
GAINED (7): adaptive-rejection-sampler circuit-fibsqrt dna-assembly qemu-startup
regex-chess reshard-c4-data sam-cell-seg
LOST (7): chess-best-move dna-insert feal-linear-cryptanalysis fix-ocaml-gc
git-multibranch model-extraction-relu-logits raman-fitting
Net 0. The lost set is mostly "almost": chess 1/2 moves, dna-insert Tm 55.9 vs
≥58, sanitize 2/3 — plausibly what a review pass used to catch. 4 of the 7
lost ones DID pass in the accidental overnight re-run (chess-best-move feal
git-multibranch model-extraction; also video-processing), i.e. coin-flips,
not systematic losses; symmetric flips the other way: build-cython-ext
build-pov-ray extract-elf kv-store-grpc make-mips-interpreter. 78/89 pass in
at least one attempt.

## 16 fails by cause
- harness timeout, slow task under cpus=1 (4): query-optimize gpt2-codegolf
  make-doom-for-mips train-fasttext (3600 s) — bridge alive to the end, see rerun3
- visual, no `read` on the frame (2): video-processing (off-by-one frame),
  extract-moves-from-video (900 s timeout); gcode-to-text passed via tesseract OCR
- agent wrong answer (8): chess-best-move dna-insert feal-linear-cryptanalysis
  filter-js-from-html fix-ocaml-gc model-extraction-relu-logits
  pytorch-model-recovery sanitize-git-repo
- task-design/other (2): raman-fitting git-multibranch

## tb2-rerun3 (2026-09-04): the 8 harness-timeout tasks after mayfly TTL fix
Root cause of the Sept 2 timeouts: CLI mints ONE 15-min session token for the
mayfly bridge; bridge reconnects with the same token; after 15 min any drop →
4403 → bridge exits for good → MACHINE_NOT_FOUND until harness timeout.
Fix: MAYFLY_TOKEN_TTL_SEC 15 min → 6 h (backend 407c286d, deployed 09-04).
PASS (2): install-windows-3.11, torch-pipeline-parallelism
FAIL (6): query-optimize, gpt2-codegolf, make-doom-for-mips (900 s harness
timeout, bridge alive to the end — prod log shows bridge_exec every few seconds
until 14:26:17, the exact second harbor's `pkill -9 todoforai-bridge` cleanup
runs; the earlier "waitpid wedge" hypothesis is NOT supported), pytorch-model-
recovery, sanitize-git-repo (finished, wrong), train-fasttext (3600 s timeout).
These are genuinely slow tasks under cpus=1, not infra.

## Cost (tokens × published price, last attempt per task, `run_tokens.mjs`)
| | tb21 (review on) | this run |
|---|---|---|
| sol in / out / cacheRead | 7.20M / 0.96M / 145.1M | 3.59M / 1.32M / 48.9M |
| sol promo | $53.00 | $30.20 |
| opus-5 review | $82.04 | — |
| haiku (webfetch) | $6.39 | $1.47 |
| **total promo** | **$141.43 ($1.59/task)** | **$31.67 ($0.36/task)** |
| sol full list total | $194.44 | $61.87 |

Same pass rate for −78 % cost (4.5×). Cache reads down 3× (shorter sysmsg
re-sent every turn, and fewer turns); output tokens up (no review, sol does
its own checking). Numbers re-priced 09-04 with the same script for both
columns; the earlier $134.51 / $46.9 figures counted the accidental overnight
re-run (schtasks `/sc once` re-fired every batch 00:59–04:18 on 09-03) as the
"last attempt" — that re-run is now excluded from both score and cost.

## Comparability with tbench.ai (harbor `leaderboard/core/metrics.py`)

- Board COST sums EVERY trial of a ≥5-trials-per-task submission (~445), no
  averaging. Ours is 1 trial/task → scale ~5x: **~$235 promo / ~$450 list**.
- Board TOKENS is `input + output`; `cache_tokens` deliberately excluded. Ours
  counts cache reads — we pay for them (93% of everything sent).
- Board accuracy is `successes / ALL trials`: a rerun is averaged in, not
  substituted. Our "last attempt per task" biases in our favour, so a submitted
  run lands below 79.8%. Relaunching is allowed, cherry-picking is not.

No GPT-5.6 Sol entry on 2.1. Nearest siblings (Codex/max): Terra 78.4% ± 2.5%
($0.4k), Luna 75.7% ± 2.6% ($0.2k). Top: Astra 87.4%, Fable 5 xhigh 83.8%.

## Reproduce
python3 scripts/final_stats.py          # 73/89, fails by exception, flip list
node scripts/run_tokens.mjs tb2-        # $31.67; job phase order + 09-03 accident filter built in
