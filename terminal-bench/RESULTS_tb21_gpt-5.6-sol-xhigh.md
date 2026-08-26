# Terminal-Bench 2.1 — gpt-5.6-sol (xhigh) — 2026-08-25/26

FINAL: 73/89 = 82.0%

Sweep: tb21-gpt-5.6-sol-xhigh-ultra (batches 1-9, 2026-08-25)
Rerun of 16 infra-damaged tasks: tb21-rerun (2026-08-26); a task's final
result is its rerun result where one exists.
All 6 accounts ultra-tier; served model verified as gpt-5.6-sol(xhigh)
from assistant message metadata (CLI header only echoes the request).

## Per-task results
0 adaptive-rejection-sampler (rerun)
1 bn-fit-modify (sweep)
1 break-filter-js-from-html (rerun)
1 build-cython-ext (rerun)
1 build-pmars (sweep)
1 build-pov-ray (rerun)
1 caffe-cifar-10 (rerun)
1 cancel-async-tasks (sweep)
1 chess-best-move (sweep)
0 circuit-fibsqrt (rerun)
1 cobol-modernization (rerun)
1 code-from-image (sweep)
1 compile-compcert (rerun)
1 configure-git-webserver (sweep)
1 constraints-scheduling (sweep)
1 count-dataset-tokens (sweep)
1 crack-7z-hash (sweep)
1 custom-memory-heap-crash (rerun)
1 db-wal-recovery (sweep)
1 distribution-search (sweep)
0 dna-assembly (rerun)
1 dna-insert (rerun)
1 extract-elf (sweep)
0 extract-moves-from-video (rerun)
1 feal-differential-cryptanalysis (sweep)
1 feal-linear-cryptanalysis (sweep)
0 filter-js-from-html (sweep)
1 financial-document-processor (sweep)
1 fix-code-vulnerability (sweep)
1 fix-git (sweep)
1 fix-ocaml-gc (sweep)
1 gcode-to-text (sweep)
1 git-leak-recovery (sweep)
1 git-multibranch (sweep)
0 gpt2-codegolf (sweep)
1 headless-terminal (sweep)
1 hf-model-inference (sweep)
1 install-windows-3.11 (sweep)
1 kv-store-grpc (sweep)
1 large-scale-text-editing (sweep)
1 largest-eigenval (sweep)
1 llm-inference-batching-scheduler (sweep)
1 log-summary-date-ranges (sweep)
1 mailman (rerun)
0 make-doom-for-mips (sweep)
1 make-mips-interpreter (rerun)
1 mcmc-sampling-stan (rerun)
1 merge-diff-arc-agi-task (sweep)
1 model-extraction-relu-logits (sweep)
1 modernize-scientific-stack (sweep)
1 mteb-leaderboard (sweep)
1 mteb-retrieve (sweep)
1 multi-source-data-merger (sweep)
1 nginx-request-logging (sweep)
1 openssl-selfsigned-cert (sweep)
1 overfull-hbox (sweep)
1 password-recovery (sweep)
1 path-tracing (sweep)
1 path-tracing-reverse (sweep)
1 polyglot-c-py (sweep)
1 polyglot-rust-c (sweep)
1 portfolio-optimization (sweep)
1 protein-assembly (sweep)
1 prove-plus-comm (sweep)
1 pypi-server (sweep)
1 pytorch-model-cli (sweep)
0 pytorch-model-recovery (sweep)
1 qemu-alpine-ssh (sweep)
0 qemu-startup (sweep)
0 query-optimize (sweep)
1 raman-fitting (sweep)
0 regex-chess (sweep)
1 regex-log (sweep)
0 reshard-c4-data (sweep)
1 rstan-to-pystan (sweep)
0 sam-cell-seg (sweep)
1 sanitize-git-repo (sweep)
1 schemelike-metacircular-eval (sweep)
1 sparql-university (sweep)
1 sqlite-db-truncate (sweep)
1 sqlite-with-gcov (sweep)
0 torch-pipeline-parallelism (rerun)
1 torch-tensor-parallelism (sweep)
0 train-fasttext (sweep)
1 tune-mjcf (sweep)
0 video-processing (sweep)
1 vulnerable-secret (sweep)
1 winning-avg-corewars (sweep)
1 write-compressor (sweep)


## Token usage and cost

Scored as 89 tasks, so costed as 89 tasks: each task's LAST attempt only.
Abandoned infra-damaged attempts are not paid for twice (counting all 102 trials
would inflate the total by the 13 retried tasks).

A trial is not one model. The main loop runs gpt-5.6-sol, but the explore,
review and webfetch tools each spawn a sub-agent on its own model — review on
claude-opus-5, the rest on claude-haiku-4.5. Those sub-agents run in their own
todos (`subTodoId` on the block), so their tokens are invisible unless you
follow the link; 83 sub-agent todos hang off the 89 task todos here.

Tokens per model, from the provider's own usage report in each message's
runMeta `extras`:

| model | in | out | cache read | cache write |
|---|---|---|---|---|
| gpt-5.6-sol (main loop) | 7.65M | 0.95M | 144.94M | 0 |
| claude-opus-5 (review) | ~0 | 1.74M | 24.31M | 2.68M |
| claude-haiku-4.5 (explore, webfetch) | 0.24M | 0.50M | 18.98M | 2.96M |

Cache reads are 93% of everything sent: an agent loop re-sends the same context
every turn. Any estimate that ignores them is off by more than half.

Priced at the provider list the product itself ships
(`frontend/src/assets/models_data.json`, $/Mtok):

| model | rate in/out/cacheR/cacheW | total | per task |
|---|---|---|---|
| gpt-5.6-sol (provider promo) | 2 / 10 / 0.2 / 2.5 | $53.82 | $0.60 |
| claude-opus-5 | 5 / 25 / 0.5 / 6.25 | $72.37 | $0.81 |
| claude-haiku-4.5 | 1 / 5 / 0.1 / 1.25 | $8.32 | $0.09 |
| **total** | | **$134.51** | **$1.51** |

At gpt-5.6-sol full list (4/20/0.4/5) instead of the promo the total is $188.33.

Worth naming: the review sub-agent costs MORE than the model being benchmarked
($72.37 vs $53.82) off 50 calls, almost all of it opus-5 output and cache
writes. Cutting review to a cheaper model would roughly halve the run.

The tokens are the measurement; the price is a parameter. What our billing
ledger actually charged is deliberately NOT the headline: it includes our own
promotional discounts (`agent/src/model_promos.jl`, 85-90% off during this run),
so nobody outside can reproduce it and it changes when a promo ends.

Reproduce: `node scripts/run_tokens.mjs tb21-` (price table at the top of that
script).

For scale, the tbench.ai 2.1 entries above us report $552.67 (Claude Code ·
Fable 5) and $2,059.19 (Codex · GPT-5.5) — but their trials-per-task is not
documented, so per-task ratios are estimates, not measured claims.
