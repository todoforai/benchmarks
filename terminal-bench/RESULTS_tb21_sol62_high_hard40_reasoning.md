# TB 2.1 hard-40 — Sol 6.2 high, reasoning-state replay (2026-11-26)

Profile `app-sol` (gpt-6.2-sol, high), bridge v1.6.3 / cli v0.1.98, agent with reasoning replay
(`e7c8b7eb`). Job `jobs/todoforai-gpt-6.2-sol-app-sol-high-hard40-reasoning__2026-11-26__06-15-44`
(+ `…-reasoning-rerun__…` for extract-elf, infra: cli "operation timed out" at start).

| | 11-20 high (no replay) | **11-26 high (replay)** |
|---|---|---|
| pass | 26/40 | **30/40** |
| LLM calls | 909 | 663 |
| output | 0.50M | 0.32M |
| cache read | 19.8M | 10.5M |
| cost, list | $11.04 | **$7.34** |
| agent time | 254 min | 158 min |

Flips: +dna-insert, +video-processing, +torch-pipeline-parallelism (old: verifier timeout),
+model-extraction-relu-logits, +vulnerable-secret (old: refusals); −raman-fitting.
k=1 noise σ≈3 tasks; 2 of the +4 are refusal luck.
Unlike Opus (context ×1.8 from replayed thinking), Sol's replayed reasoning items are compact:
fewer calls and less output, context down.
