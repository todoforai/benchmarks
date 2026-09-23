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

## Results r2 (2026-09-23, 10 tasks × 2 models × 2 sysmsgs, judges Opus 5.5 + GPT-6 Sol)
`bun run.ts --out runs/r2 && bun judge.ts runs/r2 && bun report.ts runs/r2`

| config | wall med s | tools med | cost $ (10 runs) | chars med | overall | correct | halluc/run | avg rank |
|---|---|---|---|---|---|---|---|---|
| haiku-4.5 · agent-explore | 119 | 40 | 0.330 | 7792 | 4.75 | 5.20 | 3.40 | 3.55 |
| haiku-4.5 · tfa-explore | 110 | 40 | 0.352 | 6775 | 4.65 | 5.20 | 2.75 | 3.45 |
| **luna · agent-explore** | 84 | 24 | 0.007 | 3461 | **9.20** | 9.20 | 0.15 | **1.35** |
| luna · tfa-explore | 78 | 23 | 0.008 | 2976 | 8.65 | 8.90 | 0.15 | 1.65 |

- Luna wins all 10 tasks for both judges (no self-preference: Opus gives Luna 9.0/8.5, Sol 9.4/8.8).
- Haiku's main failure = hallucinated line numbers/constants/symbols (~3 per report).
- `cost` = billed runMeta cost, i.e. after promo discount (80% off both models + Ultra boost → ~86.7% off),
  so ~1/7 of list price. The ~45× Haiku/Luna ratio is the real one (list prices differ that much).
- agent-explore ≥ tfa-explore on quality; the difference is small (n=10, one run per cell).
