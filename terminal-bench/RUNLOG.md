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
