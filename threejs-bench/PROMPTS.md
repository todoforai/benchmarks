# Prompt variants (lava-lamp, 2026-10-06)

Every variant = theme text + the contract tail (`CONTRACT.md`). Full prompts: `runner/runs/_archive/<dir>/*/prompt.txt`.
Cost = list price (v1–v5 in the archive metas were partly recorded as billed). fps = SwiftShader.

## Contract tail (what is appended to every prompt)

Old (v1–v5):
> Judged at 1280x800, headless Chrome on SwiftShader (software WebGL — keep it light), 60 s idle, no interaction, no console errors. No textures/models from the network. Preview: serve `/` … and open `/work/index.html`.

Current (v6):
> Judged at 1280x800, headless Chrome, 60 s idle, no interaction, no console errors. No textures/models from the network. Preview: serve `/` … and open `/work/index.html`; check your render at most 5–10 times.

Why: "keep it light" made Opus spend 20+ min measuring fps with its own CDP script and rewriting.
With no cap, views ranged 0–7; with the cap nobody went over 10 (OpenAI models still look ~2×, Luna 0×).

## Variants

| # | Theme text | Result |
|---|---|---|
| v1 | "A lava lamp: glass, wax, and light. Blobs rise, merge and split; lit from the bulb below. Slow and hypnotic, dark room, one hero object." | Good baseline. Medium, 2–7 min, all qualified except DeepSeek (20 min timeout). The user's favourite of v1–v4. `_archive/lava-lamp-v1` |
| v2 | v1 + "The bar: a still frame should read as a photograph…" + ordered priorities (image, motion, performance) in prose | Bad ("gagyi"). Opus hit the 30 min timeout. `_archive/lava-lamp-v2` |
| v3 | v1 + bar + bullet list "what separates strong from weak" (metaballs, wax shading, Fresnel glass, ACES, bloom…) | Bad. Spoon-feeding the technique made it look generic; Opus 30 min timeout. `_archive/lava-lamp-v3` |
| v4 | Full spec doc: role, mission, rendering/motion/perf sections, acceptance T1–T7 | Bad. Opus 25 min. `_archive/lava-lamp-v4` |
| v5 | New light wording ("…the wax glows from the bulb below and casts its warm light around.") + **"Go all out: this is your showcase of what a world-class three.js artist YOU are."** | **Astra: very nice**, $0.21, 3.6 min (medium). Opus overdid it: $2.04, 26 min (medium), 30 min at high. Judged "a bit too much" overall. `_archive/lava-lamp-v5-goallout-med`, `_archive/lava-lamp-high` |
| v5b | v5 without "Go all out", high thinking, old contract tail ("keep it light") | Opus fought SwiftShader fps for 20+ min → killed. Others fine. `_archive/lava-lamp-high-keeplight` |
| **v6** | v5 theme without "Go all out" + new contract tail (no SwiftShader, ≤5–10 checks), **high thinking**, 1 h timeout | **Current standard, published.** All 6 qualified; 1.3–7.5 min; Opus $0.56, Astra $0.60, Sonnet $0.30, 6.1-Sol $0.10, Luna $0.001 (weak, never looked at its render). High beats medium for every model at ~1.3–2.5× time/cost. `runs/threejs-bench_lava-lamp/2026-10-06__23-21-39_946485` |

## Lessons
- Short theme + contract beats spec-style prompts: listing techniques makes outputs look alike and Opus burns the whole timeout.
- "Go all out" helps Astra a lot, makes Opus over-iterate. Worth an optional "showcase" track later, not the default.
- Any performance phrase ("keep it light", "SwiftShader") triggers perf hunting. Measure fps ourselves (`perf.ts`) instead.
- Thinking level is part of the model id (`model(high)`); DeepSeek V4.1 Flash has no level → runs at its default.
