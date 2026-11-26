# TB 2.1 — Opus 5.5 high, bridge v1.6.3 / cli v0.1.98 (2026-11-25)

Profile `app` (thinking high, 80-byte sysmsg, bash-only tools, search+webfetch on), 89 tasks, k=1.
Job: `jobs/todoforai-claude-opus-5.5-app-high-v163-89__2026-11-25__16-16-39`
(+ `…-high-v163-chessrerun__2026-11-25__21-13-11`).

**80/89 (89.9%)**, list cost $50.83 (includes trials lost to the crashes below; 7 todos served
partly by the opus-4.8 refusal fallback).

| | high v1.6.3 | medium (11-15/16) |
|---|---|---|
| first sweep | 80 | 80 |
| best-of with reruns | — | 82 (83 published) |

Diffs vs medium best-of: high won mteb-retrieve, video-processing; lost break-filter-js-from-html,
crack-7z-hash (refusals), extract-moves-from-video (agent timeout), torch-pipeline-parallelism
(verifier timeout). Fails both: dna-insert, filter-js-from-html, protein-assembly,
make-doom-for-mips, schemelike-metacircular-eval.

Infra: C: filled twice (WSL vhdx) → 12 trials lost and rerun; chess-best-move lost to a timed
image prune, rerun → pass. Concurrency 6 → 4 after the second crash. See LESSONS.md.

## Follow-up (2026-11-26)
- Cost, same rules as the other sheets (cache writes counted once, last attempt per task only):
  **$48.31** (main job $48.21 + chess rerun $0.10) vs v1.0.25 high $49.87 (−3%, noise). Agent time −9%.
  Replay buys speed, not money: replayed thinking returns as cache reads.
- torch-pipeline-parallelism rerun at concurrency 1 (`…-high-v163-torchrerun__2026-11-26__12-05-17`, $0.46):
  VerifierTimeoutError again after 3/4 tests (900 s); passing runs verify in 4–12 min, so the solution is too
  slow → real fail. Score stays **80/89**.
- The 2 refusals: the Opus 4.8 fallback did trigger; 4.8 refused too on the first call ("cyber"). Same tasks
  passed in other runs (with or without fallback): sampled refusals, k=1 noise. An extra retry round
  was tried and reverted (agent `d0afd633`): it blurs k=1 and re-hits the same filter.
