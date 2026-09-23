# explore-bench

Speed + quality of the `explore` sub-agent on **real** prompts our agents sent it.

## Source
The 50 most recent non-directory-submission todos (project "TODO for AI", 2026-09-10..22)
contained **48 explore calls**, all through the `explore` tool (none through bash
`tfa-explore`). 20 were picked for diversity → `tasks.yml`.

Left out: an interrupted run, a `git diff` summary that can't be reproduced, near-duplicates
(anonymous-user capabilities ×4, brand touch-points ×3, onboarding ×3).

| category | tasks |
|---|---|
| narrow lookup | pdf-attachment-css, message-model-persisted, list-models-source, llm-usage-cost |
| trace / flow | big-red-button-scope, zele-google-signin, voice-profile-e2e, cli-env-injection, cli-isolated-workspace |
| cross-repo / multi-lang | model-registry-cliproxy, agent-uri-resolve (Julia), rclone-mount (Go), mobile-model-display (Expo) |
| external repo | cliproxyapi-external (GitHub, gh/clone) |
| broad / judgement | tfa-surface-system, react-jank-hunt, anon-vm-feasibility, product-claims-verify |
| exhaustive recall | kill-switch-map, brand-project-touchpoints |

## Files
- `tasks.yml`: per task `prompt` (`{REPO}` = monorepo root), `source` (todo + sub-todo id),
  `baseline` (original run: model, wall time, tool calls, output size), `reference`.
- `refs/<id>.md` (gitignored, local only): the original explore report. **It is not ground truth.** The repo has
  changed since then, and the baseline model can be wrong. Use it as a comparison point only.

Baseline model = `claude-haiku-4.5`: the default in
`agent/src/interfaces/clientAPI/subagent_todo.jl:238`, and none of the calls passed `model=`.
`dur_s` = the sub-todo's first to last message.

## Plan
Models: **luna6** vs **claude-haiku-4.5**, N≥2 runs per task.
- Time: wall time, time to first tool call, tool-call count, tokens and cost.
- Quality: an LLM judge (different vendor) with read access to the repo at the same commit.
  Scores: correctness (spot-check cited `file:line`), coverage of each sub-question, a
  hallucinated-path count, and concision. Then a pairwise A/B between the two models.

## Results (2026-09-23, judges Opus 5.5 + GPT-6 Sol, blinded)
Answers = the persisted final text block (`bun run.ts --refresh`); the first judging read a
transcript that included thinking and dropped some WS-closed runs (tfa-subagent fix 0b50ca3).

**r2**: 10 tasks × {Haiku 4.5, Luna} × {agent-explore, tfa-explore}, 1 run per cell

| config | wall med s | tools | $ / 10 runs | chars | overall | halluc/run |
|---|---|---|---|---|---|---|
| haiku-4.5 · agent-explore | 119 | 40 | 0.330 | 6092 | 4.70 | 4.00 |
| haiku-4.5 · tfa-explore | 110 | 40 | 0.352 | 4348 | 4.35 | 3.70 |
| luna · agent-explore | 84 | 24 | 0.007 | 3461 | 9.05 | 0.15 |
| luna · tfa-explore | 78 | 23 | 0.008 | 2976 | 8.55 | 0.25 |

**r3**: 20 tasks × {Luna ×2 runs, Opus 5.5 ×1 run} × {agent-explore, explore-v2}

| config | wall med s | tools | $ / run | chars | overall | correct | coverage | halluc/run |
|---|---|---|---|---|---|---|---|---|
| opus-5.5 · agent-explore | 99 | 26 | 0.095 | 5633 | 8.70 | 8.47 | 9.93 | 0.65 |
| opus-5.5 · explore-v2 | 97 | 28 | 0.092 | 5742 | 8.88 | 8.90 | 9.80 | 0.35 |
| luna · agent-explore | 82 | 24 | 0.0007 | 3056 | 7.01 | 8.31 | 7.63 | 0.34 |
| luna · explore-v2 | 80 | 24 | 0.0009 | 2995 | 7.16 | 8.10 | 7.72 | 0.44 |

- Luna ≫ Haiku: every task, both judges, ~45× cheaper, ~30% faster.
- Opus > Luna on all 20 tasks (+1.7 overall, mostly coverage), at ~110× the cost, ~20% slower.
  Per judge: Sol gives Opus 8.7 vs Luna 7.7 (gap 1.0), Opus gives 8.9 vs 6.5 (gap 2.4) → Opus judge self-preference roughly doubles the gap; Opus still wins.
- explore-v2 vs agent-explore: +0.15 (Luna) / +0.17 (Opus), 95% CI spans 0 → no measurable
  difference. Luna run-to-run spread is smaller with v2 (|r1−r2| 0.78 vs 1.23).
- `cost` = billed runMeta cost, after promo discount (80% off + Ultra boost → ~86.7% off), ~1/7 of list.
