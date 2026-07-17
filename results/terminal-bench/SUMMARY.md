# Terminal-Bench 2 — TODOforAI results

89 tasks, 1 trial each, harbor + `todoforai_tbench:TODOforAIHarborAgent`, 6 dev accounts, n-concurrent 6.

| Model | Date | Passed | Rate | Jobs |
|---|---|---|---|---|
| **gpt-5.6-sol (xhigh)** | 2026-07-16 | **66/89** | **74.2%** | `gpt-5.6-sol-xhigh__batch01..09__2026-07-16`, caffe retry `retry-caffe__2026-07-17` |
| claude-opus-4.7 | 2026-04-22 | 54/89 | 60.7% | `2026-04-22__16-17-47` |
| claude-opus-4.6 | 2026-04-23 | 42/89 | 47.2% | `opus-4.6__2026-04-23__17-37-27` |

gpt-5.5 (xhigh) runs from 2026-05 are invalid (stale binaries → agent crashes) and excluded.

Per-task rewards: `per_task_comparison.csv`.

## gpt-5.6-sol vs opus-4.7 deltas

- gpt-5.6 wins (18): adaptive-rejection-sampler, break-filter-js-from-html, extract-elf, feal-linear-cryptanalysis, gcode-to-text, gpt2-codegolf, largest-eigenval, merge-diff-arc-agi-task, mteb-leaderboard, mteb-retrieve, polyglot-rust-c, protein-assembly, prove-plus-comm, pytorch-model-recovery, qemu-alpine-ssh, regex-chess, sparql-university, torch-tensor-parallelism
- opus-4.7 wins (6): cobol-modernization, dna-insert, make-mips-interpreter, password-recovery, sanitize-git-repo, schemelike-metacircular-eval
- Both fail (17): chess-best-move, caffe-cifar-10, compile-compcert, configure-git-webserver, count-dataset-tokens, db-wal-recovery, dna-assembly, extract-moves-from-video, filter-js-from-html, install-windows-3-11, make-doom-for-mips, model-extraction-relu-logits, polyglot-c-py, raman-fitting, sam-cell-seg, train-fasttext, video-processing

## Run configuration (gpt-5.6-sol run)

- Agent settings on all 6 dev accounts: `model=openai:openai/gpt-5.6-sol`, `thinkingLevel=xhigh`,
  permissions `allow: ["*:*", ...]` (empty `ask`), SANDBOX devices disabled.
- Binaries compiled 2026-07-16 with bun 1.3.14 from monorepo HEAD (`scripts/rebuild_binaries.sh`).
- CLI invoked with `--agent app` pinned (see harbor_agent.py) to avoid auto-creating a
  default-model agent when path matching races edge registration.
- caffe-cifar-10 first hit a VerifierTimeoutError; clean single retry gave reward 0 → counted as fail.

## Fixes that were required to get a valid run (2026-07-16)

1. Stale compiled binaries (May 18) → rebuilt; bun 1.3.13 had an edge WebSocket-upgrade bug → bun 1.3.14.
2. `model=openai:openai/gpt-5.6` was not in the backend model registry (only `gpt-5.6-sol/terra/luna`) → todos errored with "Model not found" → switched to `gpt-5.6-sol`.
3. Path-based agent resolution auto-created fresh agents (default model, no devicesConfig) → pinned `--agent app`.
4. `device:WRITE/UPDATE/BASH` were in the `ask` list → non-interactive runs stalled on approval → moved to `allow`.
