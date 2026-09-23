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

console.log(`\n## Per task: wall s / overall (mean over judges)\n`);
const tasks = [...new Set(recs.map((r) => r.task))];
console.log(`| task | ${groups.join(" | ")} |`); console.log(`|---|${groups.map(() => "---").join("|")}|`);
for (const t of tasks) console.log(`| ${t} | ${groups.map((g) => { const r = recs.find((x) => x.task === t && cfg(x) === g); if (!r) return "–"; return `${f(r.wall_s, 0)}s / ${f(mean((scores[r.base] ?? []).map((s) => s.overall)))}`; }).join(" | ")} |`);
