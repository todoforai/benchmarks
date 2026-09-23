#!/usr/bin/env bun
/**
 * explore-bench runner: task × model × sysmsg → runs/<stamp>/<task>__<model>__<sysmsg>.{md,json}
 *
 *   bun run.ts [--tasks a,b] [--models m1,m2] [--sysmsgs agent-explore,tfa-explore] [--reps 1] [-j 4] [--out runs/x]
 *   bun run.ts --refresh --out runs/x   # re-derive .md answers + stats of finished runs from the persisted todos
 *
 * Each run = a hidden explore sub-todo, created exactly like `tfa-explore` does (runTfa from
 * api-apps/tfa-subagent: read-only whitelist read/grep/list/bash/webfetch), just with
 * the sysmsg + model swapped. Afterwards we pull cost/tokens/tool calls from the todo.
 * Env: TODOFORAI_API_URL, TODOFORAI_API_TOKEN, TODOFORAI_AGENT_SETTINGS_ID.
 */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const HERE = import.meta.dir;
const SUBAGENT = process.env.TFA_SUBAGENT_SRC ?? path.resolve(HERE, "../../api-apps/tfa-subagent/src/run.ts");
const { runTfa } = await import(SUBAGENT);

const { values } = parseArgs({
  options: {
    tasks: { type: "string" }, models: { type: "string" }, sysmsgs: { type: "string" },
    refresh: { type: "boolean", default: false },
    j: { type: "string", default: "4" }, reps: { type: "string", default: "1" }, out: { type: "string" }, repo: { type: "string" },
  },
});
const REPO = values.repo ?? path.resolve(HERE, "../..");
const MODELS = (values.models ?? "openai:openai/gpt-6-luna,anthropic:anthropic/claude-haiku-4.5").split(",");
const SYSMSGS = (values.sysmsgs ?? "agent-explore,tfa-explore").split(",");
const all: any[] = (Bun.YAML.parse(readFileSync(path.join(HERE, "tasks.yml"), "utf-8")) as any).tasks;
const pick = values.tasks?.split(",");
const tasks = pick ? all.filter((t) => pick.includes(t.id)) : all;
const OUT = values.out ?? path.join(HERE, "runs", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"));
mkdirSync(OUT, { recursive: true });

// Don't nest 40 runs under the calling agent's bash block / todo.
for (const k of ["TODOFORAI_TODO_ID", "TODOFORAI_MESSAGE_ID", "TODOFORAI_BLOCK_ID"]) delete process.env[k];
const API = process.env.TODOFORAI_API_URL!, KEY = process.env.TODOFORAI_API_TOKEN!;

async function todoStats(todoId: string) {
  const t: any = await fetch(`${API}/dst/v1/todos/${todoId}`, { headers: { "x-api-key": KEY } }).then((r) => r.json());
  const msgs: any[] = t.messages ?? [];
  const metas = msgs.flatMap((m) => (m.role === "assistant" ? m.runMeta ?? [] : []));
  const sum = (f: (x: any) => number) => metas.reduce((a, x) => a + (f(x) || 0), 0);
  const blocks = msgs.flatMap((m) => m.blocks ?? []).filter((b: any) => b.type !== "text" && b.type !== "reason");
  const texts = msgs.filter((m) => m.role === "assistant").flatMap((m) => m.blocks ?? []).filter((b: any) => b.type === "text" && b.content?.trim());
  const ts = msgs.map((m) => m.createdAt).filter(Number.isFinite);
  const models = [...new Set(metas.map((x) => x.extras?.model).filter(Boolean))];
  return {
    status: t.status, served_models: models, llm_calls: metas.filter((x) => x.type === "todo:msg_meta_ai").length,
    tool_calls: blocks.length, tool_types: blocks.reduce((a: any, b: any) => ((a[b.type] = (a[b.type] ?? 0) + 1), a), {}),
    cost: +sum((x) => x.cost).toFixed(5), input_tokens: sum((x) => x.extras?.inputTokens),
    output_tokens: sum((x) => x.extras?.outputTokens), cache_read: sum((x) => x.extras?.cacheReadTokens),
    max_context: Math.max(0, ...metas.map((x) => x.extras?.contextTokens ?? 0)),
    dur_s: ts.length ? +((Math.max(...ts) - Math.min(...ts)) / 1000).toFixed(1) : undefined,
    final: texts.at(-1)?.content ?? "",
  };
}

type Job = { task: any; model: string; sys: string; file: string };
const jobs: Job[] = [];
const REPS = +values.reps!;
for (const task of tasks) for (const model of MODELS) for (const sys of SYSMSGS) for (let rep = 1; rep <= REPS; rep++) {
  const file = path.join(OUT, `${task.id}__${model.split("/").pop()}__${sys}${REPS > 1 ? `__r${rep}` : ""}`);
  if (!existsSync(file + ".json")) jobs.push({ task, model, sys, file });
}
console.error(`${jobs.length} runs -> ${OUT}`);

async function runOne({ task, model, sys, file }: Job) {
  const prompt = String(task.prompt).replaceAll("{REPO}", REPO);
  const t0 = Date.now();
  let r: any = {}, err: string | undefined;
  try {
    r = await runTfa({
      binName: "explore-bench", systemMessage: readFileSync(path.join(HERE, "sysmsgs", `${sys}.md`), "utf-8"),
      allowedTools: ["read", "grep", "list", "bash", "webfetch"], content: prompt, model, emitResult: false,
    });
  } catch (e: any) { err = String(e?.message ?? e); }
  const wall_s = +((Date.now() - t0) / 1000).toFixed(1);
  const { final, ...stats }: any = r.todoId ? await todoStats(r.todoId).catch((e) => ({ statsError: String(e) })) : {};
  writeFileSync(file + ".md", r.result ?? "");
  const rec = { task: task.id, model, sysmsg: sys, todoId: r.todoId, exitCode: r.exitCode, err, wall_s, output_chars: (r.result ?? "").length, ...stats };
  writeFileSync(file + ".json", JSON.stringify(rec, null, 1));
  console.error(`done ${task.id} ${model} ${sys} ${wall_s}s exit=${r.exitCode ?? err}`);
}

// --refresh: the answer = the persisted final TEXT block (what the parent agent's explore tool returns),
// stats re-read after the todo finished; wall_s falls back to the todo's own duration if the stream ended early.
if (values.refresh) {
  const files = readdirSync(OUT).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    const p = path.join(OUT, f), rec = JSON.parse(readFileSync(p, "utf-8"));
    if (!rec.todoId) continue;
    const { final, ...stats }: any = await todoStats(rec.todoId);
    const early = rec.status === "RUNNING"; // stats were read while the todo still ran → the stream closed early
    const out = { ...rec, ...stats, output_chars: final.length, wall_s: early ? stats.dur_s : rec.wall_s, refreshed: true };
    writeFileSync(p.replace(/\.json$/, ".md"), final);
    writeFileSync(p, JSON.stringify(out, null, 1));
    if (early || rec.output_chars !== final.length) console.error(`refreshed ${f}: chars ${rec.output_chars}→${final.length}${early ? ` wall ${rec.wall_s}→${stats.dur_s}` : ""}`);
  }
  process.exit(0);
}

let i = 0;
await Promise.all(Array.from({ length: +values.j! }, async () => { while (i < jobs.length) await runOne(jobs[i++]); }));
console.error(`ALL DONE ${OUT}`);
process.exit(0);
