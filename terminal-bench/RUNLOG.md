# Run log — which bench ran on which proxy build

Proxy-sensitive runs: **Codex** goes pc_2 WSL cliproxy (:8317) → Anthropic.
**Ours** (todoforai `--isolated`) goes api.todofor.ai → provider; the pc_2 proxy is not in its path.
**CC** goes pc_2 cliproxy (header defaults `claude-cli/2.1.289`).

## Proxy builds
| where | build | binary mtime | process since |
|---|---|---|---|
| pc_2 WSL `~/cliproxyapi` | fork-f239c0e4 | 2026-10-05 22:59 | pid 700, 2026-10-06 16:52 (unchanged at 10-07 00:43) |
| pc-6 `~/cliproxyapi` | fork-a44cd047 (grok client 1.0.44 bump) | 2026-10-07 00:38 | restarted 2026-10-07 00:38:53 |

The 10-07 00:38 update was on **pc-6**; no TB run uses pc-6's proxy. pc_2 still runs f239c0e4.

## Runs (TB 2.1, Opus 5.5 high, k=1 unless noted)
| job | agent | tasks | proxy build | result |
|---|---|---|---|---|
| claude-code-…__2026-10-05__15-26-07 | CC 2.1.289 | 89 | pc_2, binary older than the 10-05 22:59 one (build unknown) | 78/89 |
| todoforai-…__2026-10-05__22-21-25 | ours, old prompt | 89 | n/a | 71/89 |
| codex-…__2026-10-06__16-26-05 | Codex 0.160.1 | first 20 | f239c0e4 | 16/20 |
| todoforai-…__2026-10-06__21-04-34 | ours, 1.1k prompt | first 20 | n/a | 18/20 |
| todoforai-…__2026-10-06__22-28-00 | ours + 4.8 fallback | 2 refusal tasks | n/a | break-filter 1, crack-7z 0 |
| todoforai-…__2026-10-06__22-50-06 | ours + 4.8 fallback | crack-7z k=2 (3rd killed) | n/a | 0, 0 |
| todoforai-…__2026-10-06__22-51-17 | ours + 4.8 fallback | tasks 21–40 | n/a | 18/20 |
| codex-…__2026-10-06__23-33-55 | Codex | tasks 21–40 | f239c0e4 | 16/19 + extract-moves running at 00:43 |
| (queued, TB_rest) | ours, then Codex | tasks 41–89 | f239c0e4 for Codex | — |

Junk / do not count: codex `…15-37-04`, `…16-56-30` (accidental duplicate), smoke `…15-34-14`.
Agent deploys during runs: `f032fa75` (refusal fallback) 10-06 20:04 UTC — before `…22-28-00`;
backend deploy by the user ~10-07 00:00 (announced 00:01) while only Codex `…23-33-55` ran (not affected).

## 10-07 runs
| job | agent | tasks | result |
|---|---|---|---|
| todoforai-…__2026-10-07__01-09-13 | ours (1.1k prompt + 4.8 fallback) | tasks 41–89 | 41/49 → full89 raw 77 |
| codex-…__2026-10-07__03-34-51 | Codex | tasks 41–89 | → full89 72 |
| todoforai-…__2026-10-07__06-12-30 | ours | pypi-server infra rerun | 1 → 78 |
| todoforai-…__2026-10-07__09-19-36 | ours | vulnerable-secret k=2 | 2/2 → 79 (counted by decision) |
| todoforai-…__2026-10-07__10-35-09 | ours, **new sysmsg** (A/B "B") | timeouts4 k=2 | filter-js 1/2, qemu-alpine-ssh 1/2, schemelike 1/2, make-doom 0/2 (all 4 were 0 before) |
| todoforai-…__2026-10-07__13-40-59 | ours, new sysmsg, **thinkingTokens in runMeta** | top-5 cost tasks k=1 (`tasks_top5cost.txt`) | running |

Config changes vs the 89-sweep (anything from `…10-35-09` on is NOT the 89-sweep config):
- 2026-10-07 ~10:30 sysmsg 234 B → 297 B: added the "long-running commands: pipe to a file, read it back" line.
- 2026-10-07 13:34 UTC+2 agent deploy `cf5c476e` + OpenRouter.jl `9623edf`: `extras.thinkingTokens` on AI runMeta
  (subset of outputTokens). Also fixes a cost double-count for OpenAI/xAI reasoning_tokens (ours Opus runs unaffected).

- 10-07 ~13:26: `app` sysmsg back to the 1-line original (pipe/tail line removed; it was wrong about `head`). Runs after this use 234 B sysmsg again. Still-running schemelike trial of top5cost started with the 2-line one.

## 2026-10-08 night chain (`scripts/tb_night.cmd`, Task Scheduler TB_run)
- `codex-claude-opus-4-8-high__2026-10-08__00-38-06` — Codex on Opus 4.8, the 4 Codex refusal tasks (`tasks_codex_refusals4.txt`), k=1 → Codex "with fallback" score (NEXT.md). Same "Model metadata … fallback" warning as the 5.5 runs.
- then ours video-processing A (`tasks_video.txt`, k=1, unchanged config). Bench agent permissions now `allow [device:READ, device:BASH]` + `deny device:*` (backend b8a7e50b: defaults no longer out-rank user wildcards); debug dump verified tools = read+bash only.
- Results: Codex 4.8 refusals 3/4 (protein-assembly ✗) → Codex with-fallback 75/89. video-processing A: clean run, 0 (4/5 tests). Audit: break-filter-js config rerun was in the table but not the headline → ours corrected 79 → **80/89**.
- 10-08 16:49: **video-processing B** started (`scripts/sysmsg_variant_b.py`: +1 REPL/ipykernel line, 370 B sysmsg), k=2, job `todoforai-claude-opus-5.5-app__2026-10-08__16-49-56`, log `ours-video-B.log`. Not headline-countable (config change). Restore sysmsg after: `python3 scripts/sysmsg_variant_b.py restore`.
- 10-08 23:20: video-processing B done in 5 min: **1/2** (5Rh9CNS 5/5 pass, yNfiRC4 4/5, same `test_jump_analyzer_test_video` assertion as A). Neither trial opened a REPL/ipykernel despite the sysmsg line → the hint is inert; task is ~50% noise on the hidden video, not an iteration-speed problem. Sysmsg restored to the 1-line original (234 B). B dropped.
