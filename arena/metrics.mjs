// Adds cost/turns/tool calls/solution size to <run>/meta.json.
//   node metrics.mjs <run-dir> [solution-glob ...]      (globs relative to <run>/work)
// Cost = provider-reported tokens x list price from the product's own table
// (frontend/src/assets/models_data.json), incl. explore/review sub-agent todos.
// Same method as terminal-bench/scripts/run_tokens.mjs.
import { readFileSync, writeFileSync, globSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [dir, ...globs] = process.argv.slice(2);
const BASE = process.env.TODOFORAI_API_URL || 'https://api.todofor.ai';
const here = new URL('.', import.meta.url).pathname;
const keysFile = process.env.TODOFORAI_API_KEYS_FILE || join(here, '../terminal-bench/dev_api_keys.txt');
const keys = readFileSync(keysFile, 'utf8').split('\n').map(l => l.trim().split(/\s+/)[0]).filter(k => k && !k.startsWith('#'));
const models = JSON.parse(readFileSync(join(here, '../../frontend/src/assets/models_data.json'), 'utf8')).models;
// "openai:openai/gpt-6-sol(xhigh)" -> "openai/gpt-6-sol"
const priceOf = m => models.find(x => x.id === m.replace(/^[^:]*:/, '').replace(/\(.*\)$/, ''))?.endpoints?.[0]?.pricing;
// Sub-agent runMeta carries no model name; webfetch/search default to haiku.
const SUBAGENT_MODEL = { 'Web Fetch': 'anthropic:anthropic/claude-haiku-4.5', 'Google Search': 'anthropic:anthropic/claude-haiku-4.5' };

const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
const log = readFileSync(join(dir, 'agent.log'), 'utf8');
const todoId = log.match(/todofor\.ai\/t\/([0-9a-f-]{36})/i)?.[1];

const getMessages = async id => {
  for (const key of keys) {
    const r = await fetch(`${BASE}/api/v1/todos/${id}/messages?limit=1000`, { headers: { 'x-api-key': key } });
    if (r.ok) return (await r.json()).messages;
  }
  return null;
};

const tok = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
let cost = 0, turns = 0, unpriced = new Set();
const subs = [];
const walk = (o, main) => {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) return o.forEach(v => walk(v, main));
  if (o.subTodoId && o.type) subs.push(o.subTodoId);
  const e = o.extras;
  if (e && (e.inputTokens != null || e.outputTokens != null)) {
    const t = { in: e.inputTokens || 0, out: e.outputTokens || 0, cacheRead: e.cacheReadTokens || 0, cacheWrite: e.cacheWriteTokens || 0 };
    for (const k in tok) tok[k] += t[k];
    const model = e.model || SUBAGENT_MODEL[o.description] || '?';
    if (main && e.model) turns++;   // one LLM call of the benchmarked model
    const p = priceOf(model);
    if (!p) unpriced.add(model);
    else cost += t.in * p.prompt + t.out * p.completion + t.cacheRead * (p.input_cache_read ?? p.prompt) + t.cacheWrite * (p.input_cache_write ?? p.prompt);
  }
  for (const v of Object.values(o)) walk(v, main);
};

if (todoId) {
  const msgs = await getMessages(todoId);
  if (msgs) walk(msgs, true);
  for (let i = 0; i < subs.length; i++) { const m = await getMessages(subs[i]); if (m) walk(m, false); }
}

const files = globs.flatMap(g => globSync(g, { cwd: join(dir, 'work') })).filter(f => statSync(join(dir, 'work', f)).isFile());
Object.assign(meta, {
  todo: todoId ? `https://todofor.ai/t/${todoId}` : null,
  cost_usd: +cost.toFixed(4),
  ...(unpriced.size ? { unpriced: [...unpriced] } : {}),
  tokens: tok,
  turns,
  tool_calls: (log.match(/toolCallId=/g) || []).length,
  solution_files: files,
  solution_chars: files.reduce((n, f) => n + readFileSync(join(dir, 'work', f), 'utf8').length, 0),
});
writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`   ${meta.model}: $${meta.cost_usd} · ${meta.wall_s}s · ${turns} turns · ${meta.tool_calls} tools · ${meta.solution_chars} chars`);
