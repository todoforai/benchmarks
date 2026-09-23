#!/usr/bin/env bun
/** explore-bench report: bun report.ts runs/r1 → markdown table on stdout (speed + judge scores). */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const RUN = process.argv[2]; if (!RUN) throw new Error("usage: bun report.ts <runDir>");
const recs: any[] = readdirSync(RUN).filter((f) => f.endsWith(".json")).map((f) => ({ ...JSON.parse(readFileSync(path.join(RUN, f), "utf-8")), base: f.slice(0, -5) }));
const JD = path.join(RUN, "judge");
const judged = existsSync(JD) ? readdirSync(JD).map((f) => JSON.parse(readFileSync(path.join(JD, f), "utf-8"))) : [];

// base → list of per-judge scores (+ rank position)
const scores: Record<string, any[]> = {};
for (const j of judged) {
  if (!j.parsed?.reports) continue;
  const n = Object.keys(j.map).length;
  for (const [L, base] of Object.entries<string>(j.map)) {
    const s = j.parsed.reports[L]; if (!s) continue;
    const rank = (j.parsed.ranking ?? []).indexOf(L);
    (scores[base] ??= []).push({ ...s, rank: rank < 0 ? undefined : rank + 1, n, judge: j.judge });
  }
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "–");
const cfg = (r: any) => `${r.model.split("/").pop()} · ${r.sysmsg}`;
const groups = [...new Set(recs.map(cfg))].sort();

const per = (g: string) => {
  const rs = recs.filter((r) => cfg(r) === g);
  const sc = rs.flatMap((r) => scores[r.base] ?? []);
  return {
    g, n: rs.length, ok: rs.filter((r) => r.exitCode === 0 && r.output_chars > 200).length,
    wall: median(rs.map((r) => r.wall_s)), wallMean: mean(rs.map((r) => r.wall_s)),
    llm: median(rs.map((r) => r.llm_s ?? NaN).filter(Number.isFinite)),
    other: median(rs.filter((r) => r.llm_s != null).map((r) => r.wall_s - r.llm_s)),
    perCall: median(rs.filter((r) => r.llm_s && r.llm_calls).map((r) => r.llm_s / r.llm_calls)),
    tokS: median(rs.filter((r) => r.llm_s).map((r) => r.output_tokens / r.llm_s)),
    wallP90: [...rs.map((r) => r.wall_s)].sort((a, b) => a - b)[Math.floor(rs.length * 0.9)] ?? NaN,
    tools: median(rs.map((r) => r.tool_calls ?? NaN).filter(Number.isFinite)),
    cost: rs.reduce((a, r) => a + (r.cost ?? 0), 0), chars: median(rs.map((r) => r.output_chars)),
    overall: mean(sc.map((s) => s.overall)), corr: mean(sc.map((s) => s.correctness)), cov: mean(sc.map((s) => s.coverage)),
    prec: mean(sc.map((s) => s.precision)), conc: mean(sc.map((s) => s.concision)),
    hall: mean(sc.map((s) => s.hallucinations)), rank: mean(sc.map((s) => s.rank).filter(Boolean)),
  };
};
const rows = groups.map(per);
console.log(`## Summary (${RUN})\n`);
console.log("| config | ok/n | wall med (mean) s | tools med | cost $ total | chars med | overall | correct | coverage | precision | concision | halluc/run | avg rank |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.g} | ${r.ok}/${r.n} | ${f(r.wall)} (${f(r.wallMean)}) | ${f(r.tools, 0)} | ${f(r.cost, 3)} | ${f(r.chars, 0)} | ${f(r.overall, 2)} | ${f(r.corr, 2)} | ${f(r.cov, 2)} | ${f(r.prec, 2)} | ${f(r.conc, 2)} | ${f(r.hall, 2)} | ${f(r.rank, 2)} |`);

console.log(`\n## Time (medians per run; llm = sum of LLM call time, other = wall − llm (tools, queueing, setup))\n`);
console.log("| config | wall med | wall p90 | llm s | other s | s / llm call | out tok/s |");
console.log("|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.g} | ${f(r.wall)} | ${f(r.wallP90)} | ${f(r.llm)} | ${f(r.other)} | ${f(r.perCall)} | ${f(r.tokS, 0)} |`);

const judges = [...new Set(judged.map((j) => j.judge))];
console.log(`\n## Overall by judge\n`);
console.log(`| config | ${judges.map((j) => j.split("/").pop()).join(" | ")} |`); console.log(`|---|${judges.map(() => "---").join("|")}|`);
for (const g of groups) console.log(`| ${g} | ${judges.map((J) => f(mean(recs.filter((r) => cfg(r) === g).flatMap((r) => (scores[r.base] ?? []).filter((s) => s.judge === J).map((s) => s.overall))), 2)).join(" | ")} |`);

// Paired per-task difference between sysmsgs of the same model (task mean over reps+judges), bootstrap 95% CI.
const taskMean = (g: string, t: string) => mean(recs.filter((r) => cfg(r) === g && r.task === t).flatMap((r) => (scores[r.base] ?? []).map((s) => s.overall)));
const models = [...new Set(recs.map((r) => r.model.split("/").pop()))];
const pairs: string[] = [];
for (const m of models) { const gs = groups.filter((g) => g.startsWith(m + " · ")); for (let a = 0; a < gs.length; a++) for (let b = a + 1; b < gs.length; b++) {
  const d = [...new Set(recs.map((r) => r.task))].map((t) => taskMean(gs[b], t) - taskMean(gs[a], t)).filter(Number.isFinite);
  if (d.length < 3) continue;
  const bs = Array.from({ length: 5000 }, () => mean(Array.from({ length: d.length }, () => d[Math.floor(Math.random() * d.length)]))).sort((x, y) => x - y);
  pairs.push(`| ${gs[b]} − ${gs[a]} | ${d.length} | ${f(mean(d), 2)} | [${f(bs[125], 2)}, ${f(bs[4874], 2)}] | ${d.filter((x) => x > 0).length}/${d.filter((x) => x < 0).length} |`);
} }
if (pairs.length) { console.log(`\n## Paired sysmsg diff (overall, per task)\n\n| diff | tasks | mean | 95% CI | wins/losses |\n|---|---|---|---|---|`); pairs.forEach((p) => console.log(p)); }

console.log(`\n## Per task: wall s / overall (mean over judges)\n`);
const tasks = [...new Set(recs.map((r) => r.task))];
console.log(`| task | ${groups.join(" | ")} |`); console.log(`|---|${groups.map(() => "---").join("|")}|`);
for (const t of tasks) console.log(`| ${t} | ${groups.map((g) => { const rs = recs.filter((x) => x.task === t && cfg(x) === g); if (!rs.length) return "–"; return `${f(mean(rs.map((r) => r.wall_s)), 0)}s / ${f(mean(rs.flatMap((r) => (scores[r.base] ?? []).map((s) => s.overall))))}`; }).join(" | ")} |`);
