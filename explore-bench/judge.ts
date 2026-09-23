#!/usr/bin/env bun
/**
 * explore-bench judge: per task, all candidate answers blinded + shuffled (A, B, …),
 * one read-only judge sub-todo (same whitelist as explore) that spot-checks claims in the repo
 * and returns JSON scores. Default judges: Opus 5.5 + GPT-6 Sol — stronger than the candidates and
 * one per vendor, so self-preference of either candidate family averages out.
 *
 *   bun judge.ts runs/r1 [--judges m1,m2] [-j 4]     → runs/r1/judge/<task>__<judge>.json
 */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const HERE = import.meta.dir;
const { runTfa } = await import(process.env.TFA_SUBAGENT_SRC ?? path.resolve(HERE, "../../api-apps/tfa-subagent/src/run.ts"));
const { values, positionals } = parseArgs({
  options: { judges: { type: "string" }, j: { type: "string", default: "4" }, repo: { type: "string" } },
  allowPositionals: true,
});
const RUN = positionals[0]; if (!RUN) throw new Error("usage: bun judge.ts <runDir>");
const REPO = values.repo ?? path.resolve(HERE, "../..");
const JUDGES = (values.judges ?? "anthropic:anthropic/claude-opus-5.5,openai:openai/gpt-6-sol").split(",");
for (const k of ["TODOFORAI_TODO_ID", "TODOFORAI_MESSAGE_ID", "TODOFORAI_BLOCK_ID"]) delete process.env[k];
const OUT = path.join(RUN, "judge"); mkdirSync(OUT, { recursive: true });

const tasks: any[] = (Bun.YAML.parse(readFileSync(path.join(HERE, "tasks.yml"), "utf-8")) as any).tasks;
const recs = readdirSync(RUN).filter((f) => f.endsWith(".json")).map((f) => ({ ...JSON.parse(readFileSync(path.join(RUN, f), "utf-8")), base: f.slice(0, -5) }));

const SYS = `You are a strict evaluator of codebase-exploration reports. You have read-only tools on the repo.
Several anonymous reports (A, B, …) answer the same exploration question. Judge them against the ACTUAL code, not against each other's claims.

Procedure:
1. Read the question; list its sub-questions.
2. For each report, spot-check at least 3 concrete claims (file paths, line numbers, function names, yes/no facts) with grep/read. Prefer claims where reports DISAGREE.
3. Score each report 1-10 on:
   - correctness: verified claims are right; wrong/hallucinated paths or facts are heavily penalized
   - coverage: every sub-question answered with evidence
   - precision: concrete file:line / symbols / snippets rather than vague prose
   - concision: signal-to-noise; no padding, no generic filler
   - overall: how useful this report is to the calling agent (not an average)
   Count hallucinations = verifiably wrong paths/symbols/facts.
Report length or formatting alone must not raise scores.

Your FINAL message must be ONLY one JSON object, no code fence:
{"sub_questions":[...],"reports":{"A":{"correctness":n,"coverage":n,"precision":n,"concision":n,"overall":n,"hallucinations":n,"notes":"<=2 sentences, cite what you verified"}, ...},"ranking":["A",...]}`;

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

type Job = { task: any; judge: string; file: string };
const jobs: Job[] = [];
for (const task of tasks) {
  if (!recs.some((r) => r.task === task.id)) continue;
  for (const judge of JUDGES) {
    const file = path.join(OUT, `${task.id}__${judge.split("/").pop()}.json`);
    if (!existsSync(file)) jobs.push({ task, judge, file });
  }
}
console.error(`${jobs.length} judge runs`);

async function runOne({ task, judge, file }: Job) {
  const cands = shuffle(recs.filter((r) => r.task === task.id));
  const letters = cands.map((_, i) => String.fromCharCode(65 + i));
  const body = cands.map((c, i) => {
    const txt = readFileSync(path.join(RUN, c.base + ".md"), "utf-8").trim() || "(empty — the run produced no answer)";
    return `\n\n===== REPORT ${letters[i]} =====\n${txt}`;
  }).join("");
  const content = `Repo root: ${REPO}\n\n# Exploration question\n${String(task.prompt).replaceAll("{REPO}", REPO)}${body}`;
  const t0 = Date.now();
  let r: any = {}; let err;
  try { r = await runTfa({ binName: "explore-bench-judge", systemMessage: SYS, allowedTools: ["read", "grep", "list", "bash"], content, model: judge, emitResult: false }); }
  catch (e: any) { err = String(e?.message ?? e); }
  let parsed: any = null;
  try { parsed = JSON.parse((r.result ?? "").replace(/^```(json)?|```$/gm, "").trim().match(/\{[\s\S]*\}/)![0]); } catch {}
  const map = Object.fromEntries(letters.map((l, i) => [l, cands[i].base]));
  writeFileSync(file, JSON.stringify({ task: task.id, judge, todoId: r.todoId, err, wall_s: (Date.now() - t0) / 1000, map, parsed, raw: parsed ? undefined : r.result }, null, 1));
  console.error(`judged ${task.id} by ${judge} ${parsed ? "ok" : "PARSE-FAIL"}`);
}
let i = 0;
await Promise.all(Array.from({ length: +values.j! }, async () => { while (i < jobs.length) await runOne(jobs[i++]); }));
process.exit(0);
