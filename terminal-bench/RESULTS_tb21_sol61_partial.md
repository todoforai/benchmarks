# TB 2.1 partial (45/89) — todoforai bash + tfa-cat, GPT-6.1 Sol high vs Opus 5.5 high, k=1

Stopped at 45 tasks (ChatGPT quota). Tasks 1–40 + 7 from a cancelled full sweep (minus 2 overlaps).
Opus numbers = the same tasks from the 10-25/26 sweep (`RESULTS_tb21_tfacat_opus-5.5.md`).

| | Sol 6.1 | Opus 5.5 |
|---|---|---|
| pass | **39/45 (87%)** | **40/45 (89%)** |
| cost (list) | **$3.92** | **$22.55** |

| set | Sol | Opus | Sol $ | Opus $ | job |
|---|---|---|---|---|---|
| 7 from cancelled full89 | 7/7 | 5/7 | 0.42 | 4.42 | `todoforai-gpt-6.1-sol-app-sol__2026-11-05__13-40-57` |
| 1–20 | 17/20 | 20/20 | 1.53 | 7.04 | `…__2026-11-05__14-55-27` |
| 21–40 (−2 done) | 15/18 | 15/18 | 1.97 | 8.67 | `…__2026-11-05__15-26-40` |

Prices $/1M (in/out/cacheRead/cacheWrite): Sol 2/10/0.10/2.50 (openai.com list; first draft wrongly used the backend catalog 1/5, = half), Opus 5/25/0.5/6.25.
Tokens: `node jobs/tokcmp.mjs` (todo runMeta extras, sub-todos included).
Sol writes ~3× fewer output tokens and ~0.6× the calls; input incl. cache similar.

## Setup
- Agent `app-sol` (clone of `app`): model `openai:openai/gpt-6.1-sol`, thinking high,
  **no refusal fallback** (pure Sol). `./run.sh -m openai:openai/gpt-6.1-sol -g app-sol ...`
- Served model verified: every call `gpt-6.1-sol(high)`.

## Diff vs Opus
- Sol only: dna-assembly, torch-tensor-parallelism (Opus verifier timeout), dna-insert,
  extract-moves-from-video, financial-document-processor, crack-7z-hash (no refusal on Sol).
- Opus only: break-filter-js-from-html (**OpenAI refusal**, HTTP 400 cyber; Opus solved via 4.8
  fallback), chess-best-move, configure-git-webserver, extract-elf (1/2), filter-js-from-html (1/2),
  install-windows-3.11 (3/4).

## Refusals
OpenAI refuses with HTTP 400 "flagged for possible cybersecurity risk", not a finish reason →
was a plain RequestError: no fallback, harness logged ApiError + retried. Fixed: OpenRouter.jl
`cdaa378` (→ ModelRefusalError, needs agent deploy), harness `_REFUSAL_RE` `6300436`.

Not run: 42 tasks (41–89 minus 7 done).
