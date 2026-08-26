// What did a sweep cost? The harness leaves cost_usd null, but every trial ran as a
// real todo on a dev account, so the billing ledger has the charge. A DEBIT's amount
// IS the computed USD cost (BillingService charges runMeta.cost, which already prices
// cache reads/writes); the metadata only keeps input/output token counts.
//
// Scoped by todo id, not by time: the dev accounts also run non-benchmark work and
// sub-agents bill under their own model, so a time window alone over-counts. Trial
// todo ids come from the CLI banner in each trial's agent/todoforai-cli.txt.
//
// Usage: node scripts/run_cost.mjs <job-dir-prefix> [fromISO]
//   node scripts/run_cost.mjs tb21-
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.TODOFORAI_API_URL || 'https://api.todofor.ai';
const prefix = (process.argv[2] || 'tb21-').replace(/^jobs\//, '').replace(/\*$/, '');
const from = Date.parse(process.argv[3] || '2026-08-25T00:00:00Z');
const root = fileURLToPath(new URL('..', import.meta.url));

const trialTodos = new Map();   // todoId -> job/trial
for (const job of readdirSync(join(root, 'jobs'), { withFileTypes: true })) {
  if (!job.isDirectory() || !job.name.startsWith(prefix)) continue;
  for (const trial of readdirSync(join(root, 'jobs', job.name), { withFileTypes: true })) {
    if (!trial.isDirectory()) continue;
    const f = join(root, 'jobs', job.name, trial.name, 'agent', 'todoforai-cli.txt');
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/todofor\.ai\/t\/([0-9a-f-]{36})/i);
    if (m) trialTodos.set(m[1], `${job.name}/${trial.name}`);
  }
}
console.log(`${trialTodos.size} trial todos from jobs/${prefix}*\n`);

const keys = readFileSync(join(root, 'dev_api_keys.txt'), 'utf8')
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  .map(l => { const [key, email] = l.split(/\s+/); return { key, email }; });

const byModel = new Map();
let grand = 0, offRun = 0;

for (const { key, email } of keys) {
  let page = 1, acct = 0, done = false;
  while (!done) {
    const r = await fetch(`${BASE}/api/v1/billing/transactions?limit=200&page=${page}`, { headers: { 'x-api-key': key } });
    if (!r.ok) { console.error(`${email} page ${page}: HTTP ${r.status}`); break; }
    const { transactions = [] } = await r.json();
    if (!transactions.length) break;
    for (const t of transactions) {
      if (t.type !== 'DEBIT') continue;
      if (t.createdAt < from) { done = true; continue; }   // newest-first: past the window, stop paging
      let meta = {};
      try { meta = JSON.parse(t.metadata || '{}'); } catch { /* pre-metadata rows */ }
      const amt = t.totalAmount ?? t.amount ?? 0;
      if (!trialTodos.has(meta.todoId)) { offRun += amt; continue; }
      const m = meta.model || 'unknown';
      const e = byModel.get(m) || { spent: 0, msgs: 0, inTok: 0, outTok: 0, todos: new Set() };
      e.spent += amt; e.msgs++; e.inTok += meta.inputTokens || 0; e.outTok += meta.outputTokens || 0;
      e.todos.add(meta.todoId);
      byModel.set(m, e); acct += amt;
    }
    page++;
  }
  grand += acct;
  console.log(`${email.padEnd(34)} $${acct.toFixed(2)}`);
}

console.log('\nper model (benchmark todos only):');
for (const [m, e] of [...byModel].sort((a, b) => b[1].spent - a[1].spent))
  console.log(`  ${m.padEnd(40)} $${e.spent.toFixed(2)}  ${e.msgs} msgs  ${e.todos.size} todos  ${(e.inTok / 1e6).toFixed(1)}M in  ${(e.outTok / 1e6).toFixed(2)}M out`);
console.log(`\nRUN TOTAL $${grand.toFixed(2)} over ${trialTodos.size} trials = $${(grand / trialTodos.size).toFixed(2)}/trial`);
console.log(`(other work on the same accounts in the window, excluded: $${offRun.toFixed(2)})`);
