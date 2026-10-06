# TODOforAI Benchmarks

Everything runs through our own harness (`todoforai-cli --isolated`, any model in our catalog),
each model in its own sandbox, identical prompt. Five categories:

| Bench | What | Scoring | Dir |
|---|---|---|---|
| **TerminalBench** (our rerun) | Terminal-Bench 2.1 / 4.0 tasks via Harbor adapter | pass rate | [terminal-bench/](terminal-bench/) |
| **ThreeJSBench** | one design prompt → single-file three.js page (lava lamp, rocket, ocean, turntable, black hole) | contact sheet + ranking, cost, time, qualified | [threejs-bench/](threejs-bench/) |
| **3DBench** | Blender headless: reference image / scene → render + .blend | side-by-side renders + ranking | [3d-bench/](3d-bench/) |
| **VideoBench** | the *Painted Launch Video* template sysprompt on a fixed project → MP4 | side-by-side + ranking, cost, time | [video-bench/](video-bench/) |
| **TODO Bench** | our agent pieces on real todo prompts (explore / webfetch / compaction); tasks private | judge scores | [todo-bench/](todo-bench/) |

No Elo, no public voting: a run = one `runs/<bench>_<task>/<ts>/` with every model's output,
`sheet.sh` makes the contact sheet and the results table, ranking is written by hand.

## TerminalBench 2.1 — our rerun

| Run | Pass | Cost (promo / list) | Results |
|---|---:|---:|---|
| GPT-5.6 Sol (xhigh), review off | **71/89 = 79.8%** | $46.87 / ~$89.6 | [sheet](terminal-bench/RESULTS_tb2-clean-win_gpt-5.6-sol-xhigh.md) |
| same + Claude Opus 5 review sub-agent | 73/89 = 82.0% | $134.51 / $188.33 | [sheet](terminal-bench/RESULTS_tb21_gpt-5.6-sol-xhigh.md) |

Own harness, one sweep, infrastructure-damaged tasks replaced by their rerun. Not a
tbench.ai leaderboard submission and not scored by its rules.
Methodology: https://todofor.ai/blog/terminal-bench-2-1-methodology · adapter: [terminal-bench/](terminal-bench/)

## Shared harness

- [runner/](runner/) — `run.sh <bench>/<task> [-p N] [model…]`, bubblewrap sandbox, artifact timelapse, `sheet.sh`. Legacy one-off tasks live in `runner/tasks/`.
- [pelican/](pelican/) — the original SVG one-shot (predecessor of runner).
- [online-mind2web/](online-mind2web/) + [adapter/](adapter/) — Online-Mind2Web web-agent benchmark (300 live-site tasks, WebJudge).
