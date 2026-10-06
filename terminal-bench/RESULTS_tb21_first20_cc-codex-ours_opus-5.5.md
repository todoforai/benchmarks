# TB 2.1 first 20 tasks — Claude Code vs Codex vs todoforai (Opus 5.5 high, k=1)

| task | CC 2.1.289 | Codex 0.160.1 (cliproxy) | ours (old prompt, 10-05) | ours (1.1k prompt, 10-06) |
|---|---|---|---|---|
| adaptive-rejection-sampler | 1 | **0** | 1 | 1 |
| bn-fit-modify | 1 | 1 | 1 | 1 |
| break-filter-js-from-html | 1 | **0** | **0** refusal | **0** refusal |
| build-cython-ext | 1 | 1 | 1 | 1 |
| build-pmars | 1 | 1 | 1 | 1 |
| build-pov-ray | 1 | 1 | 1 | 1 |
| caffe-cifar-10 | 1 | 1 | 1 | 1 |
| cancel-async-tasks | 1 | 1 | 1 | 1 |
| chess-best-move | 1 | 1 | 1 | 1 |
| circuit-fibsqrt | 1 | 1 | 1 | 1 |
| cobol-modernization | 1 | 1 | **0** timeout | 1 |
| code-from-image | 1 | 1 | 1 | 1 |
| compile-compcert | **0** | **0** timeout | **0** timeout | 1 |
| configure-git-webserver | **0** | 1 | **0** | 1 |
| constraints-scheduling | 1 | 1 | 1 | 1 |
| count-dataset-tokens | 1 | 1 | 1 | 1 |
| crack-7z-hash | 1 | **0** | **0** refusal | **0** refusal |
| custom-memory-heap-crash | 1 | 1 | 1 | 1 |
| db-wal-recovery | 1 | 1 | 1 | 1 |
| distribution-search | 1 | 1 | 1 | 1 |
| **total** | **18/20** | **16/20** | **15/20** | **18/20** |

First-call input context: CC ~15.4k tok, Codex ~15.4k tok, ours 1.9k (old) → **1.1k** (10-06, Resource block / list / webfetch gone).

Notes
- CC silently falls back to Opus 4.8 on `stop_reason: refusal`; break-filter-js and
  crack-7z-hash are the two tasks our agent loses to refusals. Codex has no fallback and
  fails both too (no `refusal` exception surfaced — the model just doesn't finish).
- Codex compile-compcert never hit the harness timeout: the agent exec hung ~4 h in
  `opam install coq`; killed by hand (`AgentTimeoutError` recorded). Its container is
  stuck in the Docker daemon (`docker kill` gets no exit event) — harmless, but restart
  Docker Desktop/WSL before the next full sweep.
- Rerun of ours with the 1.1k-token prompt (`jobs/todoforai-claude-opus-5.5-app__2026-10-06__21-04-34`):
  **18/20**, ties CC. cobol, compcert, configure-git-webserver now pass (k=1, so part
  of this is variance); the only losses are the two refusals the 4.8 fallback targets.
- Jobs: CC `claude-code-claude-opus-5-5-high__2026-10-05__15-26-07`, Codex
  `codex-claude-opus-5-5-high__2026-10-06__16-26-05`, ours
  `todoforai-claude-opus-5.5-app__2026-10-05__22-21-25` (subset of the 89-task run).
