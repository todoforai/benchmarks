// Token usage of a sweep — and what it would cost at official list prices.
//
// The TOKENS are the measurement: read from each message's runMeta `extras`
// (inputTokens / outputTokens / cacheReadTokens / cacheWriteTokens), which is the
// provider's own usage report. What we were BILLED is not comparable to anything
// public: our billing applies promotional discounts (agent/src/model_promos.jl),
// so a ledger total would be a number nobody else can reproduce and that changes
// when a promo ends. Cost here is therefore tokens x published price, and the
// price table is right below so it can be re-checked and re-run.
//
// Note cache reads dominate an agent loop (the same context is re-sent every turn),
// so any estimate that ignores them is off by more than half.
//
// Usage: node scripts/run_tokens.mjs <job-dir-prefix>
//   node scripts/run_tokens.mjs tb21-
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// $ per 1M tokens. Source: openrouter.ai model page, checked 2026-08-26.
// `promo` is the provider's own temporary cut (gpt-5.6-sol, through Nov 21).
const PRICES = {
  'openai:openai/gpt-5.6-sol': {
    list:  { in: 4, out: 20, cacheRead: 0.4, cacheWrite: 5 },
    promo: { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  },
};

const BASE = process.env.TODOFORAI_API_URL || 'https://api.todofor.ai';
const prefix = (process.argv[2] || 'tb21-').replace(/^jobs\//, '').replace(/\*$/, '');
const root = fileURLToPath(new URL('..', import.meta.url));

// Trial -> todo id, from the CLI banner each trial's agent log starts with.
// A task retried after an infra failure has several trials; the score counts its
// LAST attempt, so the cost must too — otherwise abandoned runs are paid twice.
// Job dir names carry batch + timestamp, so sorting them puts the latest last.
const byTask = new Map();   // task -> { todoId, trial }
for (const job of readdirSync(join(root, 'jobs'), { withFileTypes: true })
       .filter(d => d.isDirectory() && d.name.startsWith(prefix))
       .map(d => d.name).sort()) {
  for (const trial of readdirSync(join(root, 'jobs', job), { withFileTypes: true })) {
    if (!trial.isDirectory()) continue;
    const f = join(root, 'jobs', job, trial.name, 'agent', 'todoforai-cli.txt');
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/todofor\.ai\/t\/([0-9a-f-]{36})/i);
    if (!m) continue;
    byTask.set(trial.name.replace(/__[A-Za-z0-9]+$/, ''), { todoId: m[1], trial: `${job}/${trial.name}` });
  }
}
const trials = new Map([...byTask.values()].map(v => [v.todoId, v.trial]));

const keys = readFileSync(join(root, 'dev_api_keys.txt'), 'utf8')
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  .map(l => l.split(/\s+/)[0]);

const byModel = new Map();
let unreachable = 0;

for (const [todoId] of trials) {
  // Each todo belongs to one of the dev accounts; try keys until one is allowed.
  let messages = null;
  for (const key of keys) {
    const r = await fetch(`${BASE}/api/v1/todos/${todoId}/messages?limit=500`, { headers: { 'x-api-key': key } });
    if (!r.ok) continue;
    const j = await r.json();
    if (j.messages) { messages = j.messages; break; }
  }
  if (!messages) { unreachable++; continue; }
  // runMeta hides at several depths (message-level and per block), so walk the tree.
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    const e = o.extras;
    if (e && (e.inputTokens != null || e.outputTokens != null)) {
      const m = e.model || 'unknown';
      const t = byModel.get(m) || { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, msgs: 0, todos: new Set() };
      t.in += e.inputTokens || 0; t.out += e.outputTokens || 0;
      t.cacheRead += e.cacheReadTokens || 0; t.cacheWrite += e.cacheWriteTokens || 0;
      t.msgs++; t.todos.add(todoId);
      byModel.set(m, t);
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(messages);
}

const M = n => (n / 1e6).toFixed(2) + 'M';
const price = (t, p) => (t.in * p.in + t.out * p.out + t.cacheRead * p.cacheRead + t.cacheWrite * p.cacheWrite) / 1e6;

console.log(`${trials.size} tasks, last attempt each${unreachable ? ` (${unreachable} unreachable)` : ''}\n`);
for (const [model, t] of [...byModel].sort((a, b) => b[1].out - a[1].out)) {
  console.log(model);
  console.log(`  ${t.msgs} messages over ${t.todos.size} todos`);
  console.log(`  input ${M(t.in)}   output ${M(t.out)}   cacheRead ${M(t.cacheRead)}   cacheWrite ${M(t.cacheWrite)}`);
  const p = PRICES[model.replace(/\(.*\)$/, '')];   // strip the (xhigh) effort suffix
  if (!p) { console.log('  (no published price on record)\n'); continue; }
  for (const [label, tier] of Object.entries(p)) {
    const total = price(t, tier);
    console.log(`  ${label.padEnd(5)} $${total.toFixed(2)} total, $${(total / trials.size).toFixed(2)}/task` +
      `   [in $${(t.in * tier.in / 1e6).toFixed(2)} · out $${(t.out * tier.out / 1e6).toFixed(2)}` +
      ` · cacheR $${(t.cacheRead * tier.cacheRead / 1e6).toFixed(2)} · cacheW $${(t.cacheWrite * tier.cacheWrite / 1e6).toFixed(2)}]`);
  }
  console.log();
}
