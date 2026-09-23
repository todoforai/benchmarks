# TTFT benchmark — results log

Script: `ttft-check.mjs` (streams `/v1/messages` through the local CLIProxyAPI, measures first
thinking-or-text token = **any**, first answer token = **visible**). Every run appends raw samples
to `results.jsonl` (one line per model per run; fields: ts, host, prompt, runs, warmup, context,
note, label, model, anyMean, anyP50, visMean, samples, err). Add a `--note` saying why you ran it.

```bash
node benchmarks/ttft/ttft-check.mjs --runs 8 --warmup 2 --only "(none),(default)" --note "..."
jq -r 'select(.label=="haiku-4.5(none)") | [.ts, .anyMean] | @tsv' benchmarks/ttft/results.jsonl
```

Routes (all via `~/cliproxyapi/config.yaml`, host `hm`):
- Claude (haiku/sonnet/opus) — Claude OAuth pool
- `gpt-*-luna`, `gpt-6-sol` — Codex OAuth
- `glm-5.3`, `glm-5.3-flash`, `kimi-k3`, `deepseek-v4-pro`, `deepseek-v4.1-flash` — **OpenCode Go**
  subscription (`openai-compatibility` provider `opencode-go`, key `OPENCODE_API_KEY` from
  `agent/.env.production`, header `x-opencode-session` required)

Gotchas:
- Trivial prompt ⇒ no model actually thinks; level ordering on it is noise. OpenAI-side latency
  swings run-to-run (luna-5.6(none): 869ms on 2026-07-31, 2246ms on 2026-09-23).
- Opus 5.5 rejects `thinking.type.disabled` → measured as `(default)` / `(low)`.
- GLM 5.3 direct on OpenCode Go rejects disabled thinking, but `glm-5.3(none)` through the proxy works.
- Z.AI coding plan (`api.z.ai/api/coding/paas/v4`) serves glm-5.3 at ~2.2–2.5s TTFT — slow;
  Z.AI pay-as-you-go `paas/v4` has no balance. Cerebras has no GLM (only gpt-oss-120b, qwen-3.8-27b).
- After adding an `openai-compatibility` provider, hot reload logs "provider added" but models stay
  unroutable ("unknown provider") until `systemctl --user restart cliproxyapi`.

## History (pre-JSONL runs, aggregates only)

Prompt `Say "ok" and nothing else.`, 8 runs + 2 warmup unless noted. ms = mean any-token TTFT.

### 2026-07-31 — Luna 5.6 vs Haiku 4.5, all levels
| model | none | low | medium | high | xhigh | max |
|---|---|---|---|---|---|---|
| luna-5.6 | 869 | 1387 | 1280 | 1482 | 935 | 948 |
| haiku-4.5 | 962 | 1290 | 1351 | 1071 | 1449 | 1152 |

### 2026-09-23 — Luna 5.6 / Luna 6 / Sol 6 vs Haiku 4.5
| model | none | low | medium | high | xhigh | max |
|---|---|---|---|---|---|---|
| haiku-4.5 | **533** | 991 | 932 | 848 | 1000 | 869 |
| luna-5.6 | 2246 | 1481 | 1641 | 1379 | 1430 | 2210 |
| luna-6 | 1279 | 1599 | 1710 | 1404 | 1338 | 1683 |
| sol-6 | 1486 | 1650 | 1523 | 2195 | 2362 | 1922 |

### 2026-09-23 — no-thinking, Claude family vs OpenAI
| model | mean | p50 |
|---|---|---|
| haiku-4.5(none) | **516** | 504 |
| sonnet-4.5(none) | 906 | 851 |
| sonnet-5(none) | 1004 | 969 |
| opus-5(none) | 1125 | 1144 |
| luna-6(none) | 1218 | 962 |
| opus-5.5(default) | 1266 | 1267 |
| opus-5.5(low) | 1299 | 1291 |
| sonnet-4.6(none) | 1844 | 1595 |
| sol-6(none) | 2330 | 2205 |

### 2026-09-23 — GLM 5.3 direct (not via proxy, ad-hoc script), streaming chat/completions
| route | any mean | visible mean |
|---|---|---|
| OpenCode Go glm-5.3, default thinking | 577 | 1275 |
| OpenCode Go glm-5.3, reasoning_effort low | 944 (p50; mean 2881, one outlier) | same |
| OpenCode Go glm-5.3-flash, default | 930 | 1142 |
| Z.AI coding glm-5.3, thinking off | 2515 | 2515 |
| Z.AI coding glm-5.3, thinking on | 2241 | 2244 |

## JSONL runs (raw samples in `results.jsonl`)

### 2026-09-23 15:31 — first logged run, no-thinking across all providers incl. OpenCode Go
| model | mean | p50 | note |
|---|---|---|---|
| haiku-4.5(none) | **544** | 524 | |
| sonnet-4.6(none) | 971 | 963 | 1.6–1.8s in the two earlier runs today |
| sonnet-5(none) | 1024 | 1009 | |
| luna-6(none) | 1043 | 1089 | |
| opus-5(none) | 1128 | 1137 | |
| luna-5.6(none) | 1336 | 1018 | |
| opus-5.5(default) | 1338 | 1345 | |
| glm-5.3(low) | 1396 | 1413 | samples 616–2808ms, 4/8 under 720ms |
| kimi-k3(none) | 1563 | 1547 | |
| sol-6(none) | 1569 | 1550 | |
| gemini-3.8-flash(none) | 2221 | 2106 | |
| glm-5.3-flash(none) | 3054 | 3517 | |
| sonnet-4.5(none) | 8325 | 8283 | **account artifact**: every sample ~8.3s, pinned by session-affinity to `claude-marcellhavlik@todofor.ai`; 1.5s right after on another account. Rerun. |
| glm-5.3(none) | 14022 | 5863 | samples 818ms…49950ms — `(none)` on OpenCode Go is unreliable (upstream retries/queueing?); use `(low)` |
