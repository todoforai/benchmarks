# TB 2.1 full 89 — GPT-6.2 Sol high, bridge v1.6.4 / cli v0.1.99 (2026-11-26)

**76/89 (85.4%), $13.06 list**, one sweep at one thinking level (high), one bridge version, k=1.
Profile `app-sol` (`openai:openai/gpt-6.2-sol`, high), agent with reasoning-state replay. No refusal fallback.
Replaces the /bench Sol composites (6.1 high + xhigh/6.2 reruns of the fails), which mixed levels and versions.

| part | pass | cost | job |
|---|---|---|---|
| 49 non-hard | 45/49 | $5.99 | `todoforai-gpt-6.2-sol-app-sol-high-rest49__2026-11-26__15-26-22` |
| hard-40 | 30/40 | $6.83 | `todoforai-gpt-6.2-sol-app-sol-high-hard40-v164__2026-11-26__16-19-13` |
| compile-compcert infra rerun | 1/1 | $0.24 | `…-high-v164-compcertrerun__2026-11-26__17-15-35` |

compile-compcert first attempt: CLI start timed out after 32 s, no model call (NonZeroAgentExitCode) → infra rerun, passed.

Fails (13): feal-differential-cryptanalysis, feal-linear-cryptanalysis, mailman (`reading_group_confirm` module missing),
pypi-server (package not installable from :8080 at verify time), break-filter-js-from-html + vulnerable-secret
(refusals), extract-elf, filter-js-from-html, install-windows-3.11, make-doom-for-mips, mteb-retrieve, query-optimize,
sanitize-git-repo.

Not merged with the 11-26 morning hard-40 run (30/40, $7.34): that one ran on bridge v1.6.3. Rule: never merge
parts across bridge versions. Wall time 52 + 56 + 9 min at concurrency 4.
