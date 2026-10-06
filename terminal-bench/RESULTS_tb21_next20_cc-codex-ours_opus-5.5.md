# TB 2.1 tasks 21–40 — Claude Code vs Codex vs todoforai (Opus 5.5 high, k=1)

| task | CC 2.1.289 | Codex 0.160.1 | ours (old prompt, 10-05) | ours (1.1k prompt + 4.8 refusal fallback, 10-06) |
|---|---|---|---|---|
| dna-assembly | 0 | 0 | 0 refusal | 0 |
| dna-insert | 0 | 0 | 0 refusal | **1** |
| extract-elf | 1 | 1 | 1 | 1 |
| extract-moves-from-video | 0 timeout | running | 0 timeout | **1** |
| feal-differential-cryptanalysis | 1 | 1 | 1 | 1 |
| feal-linear-cryptanalysis | 1 | 1 | 1 | 1 |
| filter-js-from-html | 1 | 0 | 0 | 0 timeout |
| financial-document-processor | 1 | 1 | 1 | 1 |
| fix-code-vulnerability | 1 | 1 | 1 | 1 |
| fix-git | 1 | 1 | 1 | 1 |
| fix-ocaml-gc | 1 | 1 | 1 | 1 |
| gcode-to-text | 1 | 1 | 1 | 1 |
| git-leak-recovery | 1 | 1 | 1 | 1 |
| git-multibranch | 1 | 1 | 1 | 1 |
| gpt2-codegolf | 1 | 1 | 1 | 1 |
| headless-terminal | 1 | 1 | 1 | 1 |
| hf-model-inference | 1 | 1 | 1 | 1 |
| install-windows-3.11 | 1 | 1 | 1 | 1 |
| kv-store-grpc | 1 | 1 | 1 | 1 |
| large-scale-text-editing | 1 | 1 | 1 | 1 |
| **total** | **17/20** | **16/19** (+1 running) | **16/20** | **18/20** |

First 40 combined: ours (new) 36/40 (first-20 rerun 18 + crack-7z still 0 after k=2 with fallback), CC 35/40.

Jobs: ours `todoforai-claude-opus-5.5-app__2026-10-06__22-51-17`, Codex
`codex-claude-opus-5-5-high__2026-10-06__23-33-55`; crack-7z-hash k=2 with the 4.8
fallback: `…__2026-10-06__22-50-06` — both attempts refused by 5.5 AND 4.8 (cyber).
