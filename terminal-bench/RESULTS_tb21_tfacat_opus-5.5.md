# TB 2.1 full 89 — todoforai v1.0.11, bash + tfa-cat (no read tool), Opus 5.5 high, k=1

**81/89 (91.0%)**, single sweep, no reruns. Previous best 80/89 (10-06/07, with 2 reruns).

| harness | pass | cost (list) |
|---|---|---|
| **todoforai v1.0.11, bash + tfa-cat (10-25/26)** | **81/89** (91.0%) | $50.82 |
| todoforai v1.0.4, read + bash (10-06/07, 2 reruns) | 80/89 (89.9%) | $53.90 |
| Claude Code 2.1.289 | 78/89 (87.6%) | ≈$45.68 |
| Codex 0.160.1 | 75/89 (84.3%) | ≈$38.66 |
| todoforai old prompt (10-05) | 71/89 (79.8%) | $31.76 |

Same counting rules as `RESULTS_tb21_full89.md`. k=1 noise σ≈3 tasks: 81 vs 80 is noise; the point is that
dropping the read tool for `tfa-cat` costs nothing and the config is simpler (one tool: `bash`).

## What changed vs 10-06/07
- Bridge v1.5.71 (was 1.5.53). `tfa-cat` is built into the bridge; the agent advertises it in the bash
  description even before the mayfly tool scan finishes (agent commit `6b25f3c6`, `BRIDGE_BUILTIN_TOOLS`).
- Bench agent `app`: permissions `allow [device:BASH, device:tfa-cat]` — **no read tool**. The model gets exactly
  one tool, `bash`; images/PDFs go through `tfa-cat <file>` (attached to the bash result).
- First-call context ~1.4k tokens (was 1.1k; +tfa-cat paragraph). CC/Codex ~15.4k.
- Opus 4.8 refusal fallback on, as before.

## Batches
| batch | pass | cost | job |
|---|---|---|---|
| 1–20 | 20/20 | $7.04 | `todoforai-claude-opus-5.5-app__2026-10-25__23-54-53` |
| 21–40 | 16/20 | $12.15 | `…__2026-10-26__00-27-40` |
| 41–60 | 18/20 | $10.55 | `…__2026-10-26__10-21-19` |
| 61–89 | 27/29 | $21.08 | `…__2026-10-26__18-10-14` |

Batches 1–40 ran on agent `6b25f3c6`; 41–60 with an extra bash-description sentence ("Every call starts in the
workspace dir"), 61–89 with a `# default cwd` marker on the `$ pwd` line. Neither changed anything (see cwd note),
both reverted (`e451432d`).

## The 8 fails
| task | why | 10-06/07 |
|---|---|---|
| dna-assembly | AgentTimeoutError (4.8 fallback, 24 calls) | 0 |
| make-doom-for-mips | AgentTimeoutError — all harnesses time out | 0 |
| extract-moves-from-video | AgentTimeoutError (used tfa-cat once) | 1 |
| model-extraction-relu-logits | **VerifierTimeoutError** (900 s) — the verifier, not the agent | 0 |
| torch-tensor-parallelism | **VerifierTimeoutError** (900 s) | 1 |
| dna-insert | wrong (4.8 fallback after refusal) | 1 |
| financial-document-processor | all 17 docs read via tfa-cat, every amount right (total 81315.20 / VAT 5402.48 exact); misfiled one 440.0 "order/shipping summary" PDF vs the matching invoice → 3/7 tests | 1 |
| video-processing | 4/5 tests (`test_jump_analyzer_test_video`) — never passed by any harness | 0 |

Newly passing vs 10-06/07: break-filter-js, crack-7z-hash (first ever pass; via 4.8), filter-js-from-html,
make-mips-interpreter, pypi-server, qemu-alpine-ssh, schemelike-metacircular-eval, vulnerable-secret.
Lost: dna-insert, extract-moves-from-video, financial-document-processor, torch-tensor-parallelism (verifier).

Two verifier timeouts are not agent failures; by the counting rules they still don't get a rerun (not
`ApiError`/`NetworkConnectionError`). A rerun of those two would be fair to report separately.

## Served model (provenance.servedModel per call)
7 tasks hit the Opus 4.8 fallback: break-filter-js ✓, crack-7z-hash ✓, password-recovery ✓, protein-assembly ✓,
vulnerable-secret ✓, dna-assembly ✗, dna-insert ✗. The other 82 ran pure 5.5. Pure-5.5 score = 76/82 + 0 = 76;
with fallback 81. (CC's own fallback gives it 78, pure 74.)

## tfa-cat usage
10 tasks called it (calls / result): build-pov-ray 1 ✓, chess-best-move 1 ✓, code-from-image 1 ✓,
extract-moves-from-video 1 ✗(timeout), financial-document-processor 4 ✗, gcode-to-text 1 ✓, install-windows-3.11 2 ✓,
path-tracing 1 ✓, pytorch-model-cli 1 ✓, sam-cell-seg 1 ✓. No task failed *because* a file could not be read.

## cwd habit (side finding)
71–79% of all bash calls start with `cd /app …` even though every call already starts in `/app` (the `$ pwd`
block shows it). Tried two prompt hints (bash description sentence; `# default cwd of every bash call` on the
`$ pwd` line): 68% → 74% → 79%, i.e. no effect — trained habit, ~3 tokens/call, harmless. Reverted, not worth
more prompt.

## Cost
`scripts/run_tokens.mjs <job>`, list price (5.5 and 4.8: $5/$25 in/out, $0.5 cache read, $6.25 cache write).
Output tokens dominate ($36 of $51); cache reads 9.4M tokens.
