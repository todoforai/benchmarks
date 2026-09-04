# Terminal-Bench 2.1 — gpt-5.6-sol (xhigh), review OFF, sysmsg diet — 2026-09-02/03

FINAL: 73/89 = 82.0%   (baseline tb21 with review sub-agent: 73/89 = 82.0%, $134.51)
(71/89 before tb2-rerun3; +install-windows-3.11 +torch-pipeline-parallelism after the mayfly token TTL fix)

Sweep: tb2-clean-win__0901-1800 (batches 1-9, Windows/WSL, 5 concurrent) +
tb2-rerun1__0902 (7 infra victims, 10 conc) + tb2-rerun2__0902 (5 batch-9 tasks I
killed by starting rerun1 in parallel — run_batches.sh prunes all containers) +
tb2-visual__0903 (3 image tasks after ReadTool description fix) +
tb2-rerun3__0904 (8 harness-timeout tasks after mayfly token TTL 15 min → 6 h).
Final = last rerun result where one exists.

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
LOST (9): chess-best-move dna-insert feal-linear-cryptanalysis fix-ocaml-gc
git-multibranch install-windows-3.11 model-extraction-relu-logits raman-fitting
sanitize-git-repo
Net −2 tasks. The lost set is mostly "almost": chess 1/2 moves, dna-insert Tm
55.9 vs ≥58, install-windows 3/4 tests, sanitize 2/3 — plausibly what a review
pass used to catch.

## 18 fails by cause
- harness timeout 900 s (8): make-doom-for-mips pytorch-model-recovery
  install-windows-3.11 query-optimize sanitize-git-repo gpt2-codegolf
  train-fasttext torch-pipeline-parallelism (this one spent 17 webfetches
  googling the task text for a ready solution)
- visual, no `read` on the frame (2): video-processing (off-by-one frame),
  extract-moves-from-video; gcode-to-text passed on retry via tesseract OCR
- agent (6): chess-best-move dna-insert feal-linear-cryptanalysis filter-js-from-html
  fix-ocaml-gc model-extraction-relu-logits
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
| sol in / out / cacheRead | 7.65M / 0.95M / 144.9M | 4.36M / 1.69M / 85.2M |
| sol promo | $53.82 | $42.70 |
| opus-5 review | $72.37 | — |
| haiku (webfetch) | $8.32 | $4.17 |
| **total promo** | **$134.51 ($1.51/task)** | **$46.87 ($0.53/task)** |
| sol full list total | $188.33 | ~$89.6 |

Per-task divides by the 89 scored tasks in both columns.

−2.2 pp pass for −65 % cost. Cache reads halved (shorter sysmsg re-sent every
turn); output tokens up (no review, sol does its own checking).
Not counted: an accidental overnight re-run of all three jobs (schtasks
`/sc once` fired again at 00:59) — same again, ~$47.

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
node scripts/run_tokens.mjs tb2-clean-win__0901-1800__batch0
node scripts/run_tokens.mjs tb2-rerun1__0902 ; … tb2-rerun2__0902 ; … tb2-visual__0903
