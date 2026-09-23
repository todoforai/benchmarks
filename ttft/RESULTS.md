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

### 2026-09-23 16:00 — rerun of the two outliers, 15 runs + 2 warmup
| model | mean | p50 | samples (ms) |
|---|---|---|---|
| haiku-4.5(none) | **545** | 524 | 461–906, tight |
| glm-5.3(low) | 760 | 689 | 540–1576, 13/15 under 1s |
| glm-5.3(none) | 1027 | 724 | 575–2065, bimodal (~650 vs ~1.8s) |
| sonnet-4.5(none) | 1486 | 1092 | 850–3656, tail on account `havliktomi@` |

Conclusions:
- sonnet-4.5's 8.3s in the 15:31 run was the pinned `marcellhavlik@todofor.ai` account, not the model.
  Session-affinity pins a whole run to one account ⇒ one bad account skews a whole row.
- glm-5.3 via OpenCode Go is ~0.7s p50 — second only to haiku — but its tail is noisy
  (earlier run had 40–50s samples). `(low)` is both faster and steadier than `(none)`.

### 2026-09-23 16:30 — validation (`validate-streaming.mjs`): 150-word answer, interleaved, 6 runs
| target | any p50 | **visible p50** | total p50 | deltas | served model |
|---|---|---|---|---|---|
| haiku-4.5(none) | 621–763 | **621–763** | ~3.1s | ~93 | claude-haiku-4-5-20251001 |
| sonnet-5(none) | 660 | **660** | 4.6s | 84 | claude-sonnet-5 |
| glm-5.3(none) via proxy | 1371 | **1858** | 5.6s | 220 | glm-5.3 |
| glm-5.3(low) via proxy | 905 | **11263** | 12.8s | 1089 | glm-5.3 |
| glm-5.3 low, direct OpenCode Go | 1130 | **8554** | 10.1s | 936 | glm-5.3 |

- Streaming is real (total ≫ TTFT, 80–1000+ deltas) and the served model matches.
- **The `Say "ok"` numbers overstate GLM.** On a trivial prompt its thinking is a few tokens, so
  any ≈ visible ≈ 0.7s. On a real answer `(low)` thinks ~10s before the first visible word;
  `(none)` still emits some thinking (any ≠ visible) → ~1.9s visible. For user-facing latency
  compare **visible TTFT on a non-trivial prompt**.
- Proxy overhead vs direct OpenCode Go is not measurable at this n (proxy was not slower).

### 2026-09-23 17:00 — long prompt, all models (`--prompt "Write exactly 150 words about the history of bridges. No preamble."`), 8 runs
Ranked by **visible p50** (first answer word — what the user waits for). ms.

| model | visible p50 | visible mean | any p50 | total | note |
|---|---|---|---|---|---|
| haiku-4.5(none) | **502** | 512 | 502 | 3.2s | tight 471–636 |
| sonnet-5(none) | **593** | 599 | 593 | 4.4s | tight 575–626 |
| glm-5.3(none) | 1031 | 2630 | 976 | 5.9s | one 13.6s sample |
| glm-5.3(low) | 1060 | 1254 | 835 | 4.4s | this run all short; see bimodal note |
| opus-5(none) | 1106 | 1120 | 1106 | 7.3s | |
| sonnet-4.5(none) | 1126 | 1544 | 1126 | 7.0s | one 5s sample |
| luna-6(none) | 1343 | 1275 | 1343 | 8.7s | |
| sonnet-4.6(none) | 1530 | 1555 | 1530 | 6.4s | |
| kimi-k3(none) | 1760 | 4019 | 1188 | 6.3s | 3/8 samples 6–12s (thinks anyway) |
| sol-6(none) | 2499 | 3815 | 2499 | 9.7s | one 11.6s sample |
| glm-5.3-flash(none) | 4945 | 7167 | 4934 | 12.0s | |
| opus-5.5(default) | 11492 | 11225 | 1271 | 13.5s | adaptive thinking ~10s on every request |
| luna-5.6(none) | 13859 | 12439 | 13859 | 16.1s | proxy logs "budget zero not allowed" → reasoning not disabled, hidden (not streamed) |
| gemini-3.8-flash(none) | 18007 | 18476 | 18007 | 20.6s | `-high` variant, hidden reasoning |

**GLM-5.3 thinking is bimodal** (`glm-thinking-variance.mjs`, 16 requests, `(low)`): thinking is
either ~40 chars (visible 0.7–2s) or ~3000 chars (visible 8–17s), ~1/3 of requests long. Not caused
by user-agent or session id. The 16:30 validation happened to hit mostly long ones (p50 11s), this
run mostly short (p50 1.06s). Real expectation for GLM: ~1s typical, ~10s on a third of requests.

Takeaways: on a real answer only haiku-4.5 and sonnet-5 are consistently ~0.5–0.6s. Opus 5.5,
luna-5.6 and gemini-3.8-flash-high spend 10–18s thinking before the first word even when asked
for no thinking. For latency-critical paths: haiku-4.5, then sonnet-5.

### Same long-prompt run — reliability & speed stats (`tail -14 results.jsonl | node stats.cjs`)
Sorted by worst sample. CV = stddev/mean of visible TTFT. gen = total − visible (time to stream
~150 words). n=8, so "worst" is one sample; p50 here is lower-median (ttft-check prints upper).

| model | vis p50 | worst | CV% | <1s | <2s | gen p50 | total p50 |
|---|---|---|---|---|---|---|---|
| sonnet-5(none) | 588 | **626** | **3** | 8/8 | 8/8 | 3795 | 4379 |
| haiku-4.5(none) | **495** | 636 | 10 | 8/8 | 8/8 | 2615 | **3119** |
| opus-5(none) | 1064 | 1446 | 13 | 3/8 | 8/8 | 6247 | 7244 |
| luna-6(none) | 1217 | 1563 | 16 | 0/8 | 8/8 | 7238 | 8681 |
| sonnet-4.6(none) | 1488 | 2018 | 20 | 0/8 | 7/8 | 4751 | 6037 |
| glm-5.3(low) | 922 | 2497 | 50 | 4/8 | 6/8 | 3074 | 4116 |
| sonnet-4.5(none) | 1058 | 4953 | 84 | 1/8 | 7/8 | 5339 | 6476 |
| sol-6(none) | 2266 | 11563 | 82 | 0/8 | 2/8 | 6027 | 8908 |
| opus-5.5(default) | 10928 | 12073 | 6 | 0/8 | 0/8 | 2211 | 13139 |
| kimi-k3(none) | 1396 | 12263 | 96 | 0/8 | 5/8 | 2480 | 4477 |
| glm-5.3(none) | 772 | 13626 | 159 | 4/8 | 7/8 | 3134 | 4159 |
| luna-5.6(none) | 12408 | 17555 | 28 | 0/8 | 0/8 | 3629 | 16104 |
| glm-5.3-flash(none) | 4917 | 22789 | 82 | 0/8 | 0/8 | 4912 | 10226 |
| gemini-3.8-flash(none) | 18004 | 29930 | 27 | 0/8 | 0/8 | 764 | 18502 |

- Only haiku-4.5 and sonnet-5 were under 1s on every request; both also have the lowest CV.
- Full answer: haiku fastest (3.1s); GLM/kimi generate fast (~2.5–3s) but their thinking tail makes
  first-word latency unpredictable. luna-6 and opus-5 generate slowly (6–7s for 150 words).
- gen p50 ≠ throughput: gemini's 764ms means text arrives in one burst after hidden reasoning.

## TTFT ≠ JARVIS turn latency (2026-09-23)
`frontend/jarvis-flows` (real persona + tool set, 13 flows / 27 turns), 3 runs per model:

| model | failed turns | turn p50 | turn p90 | max | no-tool turn p50 | suite |
|---|---|---|---|---|---|---|
| claude-haiku-4-5 | 3/81 | 2.0s | 2.5s | 4.2s | 0.9s | ~48s |
| claude-sonnet-5 | 2/81 | 2.6s | 5.1s | 8.2s | 1.6s | ~81s |

With the large JARVIS system prompt and tools, Sonnet 5's short-prompt TTFT lead goes away: whole
turns are 1.3–2× slower and it talks longer. Haiku's failures were all narration ("I'll check…");
Sonnet's were one extra answer_todo call and a 13-word ack (limit 10). Kept JARVIS on Haiku.
