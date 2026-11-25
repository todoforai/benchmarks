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
