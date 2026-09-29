# Long-running TB 2.1 trials — where the wall-clock goes (2026-09-29)

Scope: every bench todo from 09-26 on with ≥400 s of activity (42 todos: `full__0926` sweep
xhigh, `high-timeouts__0928` high, polyglot 0928/0929). Source is the backend only
(`GET /api/v1/todos/<id>/messages` + result attachments); `pc_2` was offline, so the
harness side (`result.json`, setup/verifier) was **not** measured, see "Gaps in the data".

## Method (time model)
- LLM call = `runMeta(todo:msg_meta_ai).elapsed`, ends at `runMeta.timestamp`.
- Tool = LLM end → latest result attachment `createdAt` of that turn (parallel calls: max).
- Gap = previous tool end → next assistant message `createdAt`.
- Thinking share = `outputTokens` − visible text/cmd chars/3.5 (**estimate**; reasoning
  blocks are summaries, so they can't be counted directly).
- Tool outputs ≥100 s were downloaded (`/api/v1/resources/?uri=todoforai:todos/<id>/<att>`)
  and classified: `hung` = "bridge sent no result", `parked` = `[detached — pid]`,
  `poll` = sleep/while-pgrep loop, `install` = apt/pip/opam, `run` = the rest.

## Totals (42 todos, 49 548 s activity)
| bucket | s | % | note |
|---|---:|---:|---|
| LLM generation | 25 651 | 52 | 813 turns, 89 tok/s, ~94 % of output tokens are thinking (est.) |
| └ turns >60 s | 17 937 | 36 | 108 turns (13 %); max 58 k output tokens / 854 s in one turn |
| tool `run` (real work) | 8 238 | 17 | builds, training, OCR, queries |
| tool `hung` (no result, lost output) | 7 985 | 16 | 17 calls, **all before fc53f37f** (0 after) |
| tool `poll` (sleep / wait loops) | 4 761 | 10 | fixed leading `sleep N`: 945 s |
| tool `install` | 1 798 | 4 | |
| tool `parked` | 1 259 | 3 | 5 calls, all tzdata/apt prompts or their pollers |
| gaps / overhead | 1 213 | 2 | median 1.4 s, p99 4.6 s, max 6.6 s per turn |

Backend/bridge per-call latency is **not** a cause (2 %). No reconnect gaps seen, one
"backend restarted mid-command" note (b6e31e25).

## Per trial
| task | todo | model | total | LLM | tools | #turns | #calls | biggest wait |
|---|---|---|---:|---:|---:|---:|---:|---|
| train-fasttext | 07e7bdfd | xhigh | 3174 | 155 | 3019 | 30 | 29 | 605 s tool (hung ×3) |
| corewars | 17881b21 | xhigh | 3141 | 2668 | 463 | 33 | 31 | 345 s tool; 19 turns >60 s |
| cyberpunk (arena, 4.6) | 8fa3a813 | 4.6 high | 2471 | 1826 | 645 | 83 | 82 | 854 s LLM |
| **schemelike-metacircular** (0928) | 24e9e9d8 | high | 2241 | 2234 | 11 | 18 | 18 | 347 s LLM; 13 turns >60 s, 205 k out tok |
| mask-polylines (MobileSAM) | 2a722c1a | xhigh | 2175 | 829 | 1346 | 26 | 27 | 305 s tool (hung) |
| schemelike (0926) | 83f0588d | xhigh | 2169 | 2164 | 5 | 11 | 12 | 584 s LLM |
| mips-interpreter | d4212fec | xhigh | 1990 | 1826 | 164 | 38 | 39 | 240 s LLM |
| extract-moves (0926) | 5b842ec0 | xhigh | 1968 | 270 | 1698 | 30 | 33 | 605 s tool (hung ×2) |
| **extract-moves** (0928) | d286a6c7 | high | 1955 | 72 | 1883 | 17 | 17 | 605 s tool (hung); 748 s polling OCR |
| chess-regex | f487b8e0 | xhigh | 1946 | 808 | 1138 | 17 | 16 | 605 s tool (hung) |
| caffe-cifar10 | c4dffab6 | xhigh | 1935 | 135 | 1801 | 22 | 21 | 605 s tool (hung ×2) |
| install-windows-3.11 | 3b5c18bd | xhigh | 1740 | 580 | 1160 | 74 | 91 | 374 s tool |
| schemelike (0926 #1) | 6dff066b | xhigh | 1446 | 1444 | 2 | 8 | 7 | 527 s LLM |
| compress scripts | 59ef6a60 | xhigh | 1426 | 562 | 864 | 21 | 20 | 451 s tool |
| compcert | 64fc3df6 | xhigh | 1367 | 182 | 1181 | 29 | 27 | 449 s tool (opam build) |
| rstan→pystan | 8f45abcd | xhigh | 1205 | 119 | 1086 | 15 | 14 | 605 s tool (hung) |
| query-optimize (0926) | e6b6859f | xhigh | 1087 | 147 | 940 | 16 | 16 | 387 s tool |
| make-doom (0926) | a26fe52a | xhigh | 1036 | 1034 | 2 | 13 | 15 | 218 s LLM |
| cobol (0926) | 4d6b8470 | xhigh | 940 | 935 | 6 | 17 | 17 | 130 s LLM |
| **make-doom-for-mips** (0928) | afaf441a | high | 895 | 884 | 11 | 14 | 17 | 149 s LLM; 8 turns >60 s |
| **cobol-modernization** (0928) | f996d8be | high | 730 | 654 | 80 | 36 | 36 | 57 s LLM |
| filter-js (refused ×3) | 6f32dd4f… | xhigh | 412–715 | ~100 % | ~0 | 3–5 | 2–4 | up to 307 s LLM |
| adaptive-rejection (0926) | cf46c526 | xhigh | 654 | 630 | 24 | 4 | 4 | 329 s LLM |
| polyglot-c-py ×6 (pre-fix) | 9c83a519… | high/xhigh | 413–498 | 49–189 | 309–443 | 6–9 | 5–8 | 305–321 s apt tzdata prompt |
| **query-optimize** (0928) | ae468245 | high | 377 | 38 | 338 | 6 | 5 | 336 s tool (original query run) |
| **adaptive-rejection** (0928) | efa5c212 | high | 316 | 236 | 80 | 14 | 13 | 139 s LLM |
| polyglot-c-py (post-fix c2166ff) | 2f5bc569 | high | **71** | 60 | 11 | 5 | 4 | 27 s LLM |

Two distinct shapes, almost nothing in between:
- **LLM-bound** (schemelike, doom, cobol, corewars, ARS, filter-js): 85–100 % LLM, few turns,
  each 100–580 s / 10–58 k output tokens. The model writes/simulates whole programs in thinking
  instead of running code. `high` vs `xhigh` has the *same* per-turn mean (32.2 s vs 32.7 s,
  3.0 k tokens) — the effort level is not what makes these long; the task shape is.
- **Tool-bound** (fasttext, caffe, extract-moves, compcert, pystan): LLM <15 %; time is real
  compute plus the 605 s "hung" blocks and polling.

## Top causes, ranked by seconds
1. **Long single thinking turns — 17.9 ks (36 %).** 108 turns >60 s. At 89 tok/s this is pure
   token count. Upper bound of what a per-turn cap would cut: cap 60 s → 11.5 ks, 120 s → 6.4 ks,
   300 s → 1.7 ks (quality impact unknown).
2. **The 600 s backend cap + old tight deadline → "hung" — 8.0 ks (16 %).** `AgentHandler.ts:793`
   still clamps every bash `timeout` to 600 s (`Math.min(timeout, 600)`); 60 calls asked for more
   (900–3600 s), the model is never told. Before fc53f37f the backend answered at cap+5 s with
   `TIMEOUT: bridge sent no result` → the output was lost, the next turns re-probed with
   `ls`/`pgrep` (+ `pgrep: not found` in slim images). The compute itself was mostly real (the
   builds/training kept running), so the true loss is the lost output + re-poll turns, not the
   full 8 ks. 0 occurrences after fc53f37f; after it these become `[detached]` parks at ~600 s.
3. **Polling — 4.8 ks (10 %).** `while pgrep …; sleep 10`, `for i in $(seq 1 85) … sleep 10`,
   leading fixed `sleep 60/120/150` (945 s total). Mostly waiting for real work, not waste; the
   waste is the fixed sleeps that overshoot (e.g. `sleep 60` then the result was ready).
4. **Interactive apt prompt waiting out the full timeout — 2.5 ks in 8 calls** (each 305–321 s,
   `awaitingInput=true` but still waits until `timeout`). Fixed for bench by c2166ff:
   same polyglot task 413–498 s → **71 s**.
5. **Gaps/overhead — 1.2 ks (2 %).** Not worth optimizing.

## Proposals (general, no per-task prompts) — need approval, nothing changed
| # | change | where | expected saving |
|---|---|---|---|
| 1 | Keep `DEBIAN_FRONTEND=noninteractive` (done, c2166ff); also default it in the bridge shell env for all users, not only the harness | bridge | ~300 s per apt-install trial (8/42 long trials) |
| 2 | **Early park on input wait**: when the fg process blocks on a tty read with no output for N s (e.g. 20 s), park immediately with the prompt tail instead of waiting until `timeout` | bridge | ~280 s per hit; covers any prompt (tzdata, ssh, git, pip) |
| 3 | **Tell the model the real cap**: bash tool schema `timeout` "max 600", and the park text "requested 1800 s, clipped to 600 s, still running (pid N)" — or raise the cap now that the bridge owns the deadline (plan A in `backend/plan/bridge-single-deadline-owner.md`) | backend + agent | removes blind re-probes after long runs; ~1–2 turns + up to one 600 s mis-sized wait per long build |
| 4 | **Wait-until primitive**: bash `wait_for=<pid|file|regex>` that returns as soon as the condition holds (≤ timeout), replaces sleep loops | agent + bridge | fixed-sleep overshoot (~0.9 ks here) + poll turns |
| 5 | Per-turn thinking budget (e.g. 16–24 k tokens, `budget_tokens`) for the bench agent; re-measure pass rate on the LLM-bound set before adopting | agent config | up to 6.4 ks (≈120 s cap) — **uncertain**: may cost passes |
| 6 | Faster serving route for Opus (89 tok/s now) | provider | LLM share scales linearly (52 % of time) |

Not worth it: backend/bridge per-call latency (median 1.4 s/turn).

## Gaps in the data
- `pc_2` offline → harness setup/verifier time not measured (`scripts/phase_times.sh` on the
  `0926`/`0928` job dirs). From the 0928 numbers given (harness vs todo): schemelike 2467 vs
  2241 s (~226 s outside the agent), doom 922 vs 895, cobol 731 vs 730, query 379 vs 377,
  ARS 317 vs 316 → setup+verifier is small except schemelike (verify: whose clock).
  extract-moves: todo ran 1955 s vs harness 1849 s → todo kept running ~100 s after the
  harness agent timeout (cancel latency; check).
- Thinking vs visible split is estimated from chars/3.5.
