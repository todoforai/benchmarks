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

## Plan (not run yet)
Models: **luna6** vs **claude-haiku-4.5**, N≥2 runs per task.
- Time: wall time, time to first tool call, tool-call count, tokens and cost.
- Quality: an LLM judge (different vendor) with read access to the repo at the same commit.
  Scores: correctness (spot-check cited `file:line`), coverage of each sub-question, a
  hallucinated-path count, and concision. Then a pairwise A/B between the two models.
