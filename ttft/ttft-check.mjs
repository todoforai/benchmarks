#!/usr/bin/env node
/**
 * TTFT (time-to-first-token) check via CLIProxyAPI.
 *
 * Streams a short prompt from each model and measures how long until the first
 * text token arrives. Compares GPT-5.6 Luna across every reasoning-effort level
 * (low / medium / high / xhigh / max) against Claude Haiku 4.5.
 *
 * Reasoning effort is passed with CLIProxyAPI's `model(level)` suffix syntax.
 * Every run appends raw samples to results.jsonl next to this script (see RESULTS.md).
 *
 * Env: CLIPROXYAPI_API_KEY (default: first api-keys entry of ~/cliproxyapi/config.yaml),
 *      CLIPROXYAPI_URL (default http://localhost:8317).
 * Usage: node benchmarks/ttft/ttft-check.mjs [--runs N] [--warmup N] [--prompt "..."] [--only sonnet,gemini]
 *        [--context N] [--note "why this run"]
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { hostname, homedir } from 'node:os';

const BASE_URL = process.env.CLIPROXYAPI_URL ?? 'http://localhost:8317';
const API_KEY = process.env.CLIPROXYAPI_API_KEY ?? (() => {
  try { return readFileSync(`${homedir()}/cliproxyapi/config.yaml`, 'utf8').match(/^api-keys:\s*\n\s*-\s*"?([^"\n]+)"?/m)?.[1] ?? ''; }
  catch { return ''; }
})();
const RESULTS_FILE = new URL('./results.jsonl', import.meta.url);

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const RUNS = Number(getArg('--runs', '3'));
const WARMUP = Number(getArg('--warmup', '1'));
const PROMPT = getArg('--prompt', 'Say "ok" and nothing else.');
// --context N: prepend ~N tokens of deterministic filler as a cache_control system prompt.
// Identical bytes every request, so the warmup run primes the provider prompt cache and the
// measured runs hit it (Anthropic reports it in usage.cache_read_input_tokens).
const CONTEXT_TOKENS = Number(getArg('--context', '0'));
const NOTE = getArg('--note', '');
const CONTEXT = CONTEXT_TOKENS
  ? Array.from({ length: Math.ceil(CONTEXT_TOKENS / 10) }, (_, i) =>
      `Fact ${i}: the ${['red', 'blue', 'green', 'gold'][i % 4]} ledger entry ${i * 7} sums to ${(i * 31) % 997}. `)
      .join('')
  : '';

const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
// Both models accept CLIProxyAPI's `model(level)` suffix: for Luna it sets reasoning
// effort, for Haiku 4.5 it enables extended thinking with a matching budget. A no-suffix
// entry (none) disables reasoning explicitly and is the baseline for each.
// `levels: false` = (none) only (no reasoning-effort suffix sweep); `levels: [...]` = only those.
// `noOff: true` = model can't disable thinking (Opus 5.5: adaptive only) → bare model (default) instead of (none).
const MODELS = [
  { name: 'luna-5.6', model: 'gpt-5.6-luna' },
  { name: 'luna-6', model: 'gpt-6-luna' },
  { name: 'sol-6', model: 'gpt-6-sol' },
  { name: 'haiku-4.5', model: 'claude-haiku-4-5-20251001' },
  { name: 'sonnet-4.5', model: 'claude-sonnet-4-5-20250929', levels: false },
  { name: 'sonnet-4.6', model: 'claude-sonnet-4-6', levels: false },
  { name: 'sonnet-5', model: 'claude-sonnet-5', levels: false },
  { name: 'opus-5', model: 'claude-opus-5', levels: false },
  { name: 'opus-5.5', model: 'claude-opus-5-5', levels: ['low'], noOff: true },
  // OpenCode Go subscription via the proxy's openai-compatibility provider `opencode-go`.
  { name: 'glm-5.3', model: 'glm-5.3', levels: ['low'] },
  { name: 'glm-5.3-flash', model: 'glm-5.3-flash', levels: false },
  { name: 'kimi-k3', model: 'kimi-k3', levels: false },
  { name: 'gemini-3.8-flash', model: 'gemini-3.8-flash-high', levels: false },
];
// --only a,b  → keep targets whose label contains any of the substrings.
const ONLY = getArg('--only', '').split(',').filter(Boolean);
const TARGETS = MODELS.flatMap(({ name, model, levels = true, noOff = false }) => [
  noOff
    ? { label: `${name}(default)`, model }                  // provider-default thinking
    : { label: `${name}(none)`, model: `${model}(none)` },  // reasoning explicitly off
  ...(levels === true ? LEVELS : levels || []).map((level) => ({ label: `${name}(${level})`, model: `${model}(${level})` })),
]).filter(({ label }) => !ONLY.length || ONLY.some((o) => label.includes(o)));

const headers = {
  'x-api-key': API_KEY,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json',
  // Pose as the official CLI so the proxy skips cloaking (matches LLMService.ts).
  'user-agent': 'claude-cli/1.0.0 (external, cli)',
  // One conversation per run: the proxy pins it to one credential (routing.session-affinity),
  // so warmups prime the cache the measured runs hit — same path the agent/backend use.
  'x-claude-code-session-id': `ttft-${Date.now().toString(36)}`,
};

/**
 * Stream one request; resolve timings in ms:
 *   any     time-to-first-token of ANY kind (thinking OR text) — raw model latency
 *   visible time-to-first-VISIBLE token (text_delta) — what a user actually waits for
 * With extended thinking on, `any` fires on the thinking block and `visible` fires later
 * once the answer starts; without thinking the two are equal.
 */
async function measure(model) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(60_000),   // a hung stream must not stall the whole sweep
    // Enough headroom for a thinking budget + short answer (Anthropic thinking needs room).
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: true,
      ...(CONTEXT && { system: [{ type: 'text', text: CONTEXT, cache_control: { type: 'ephemeral' } }] }),
      messages: [{ role: 'user', content: PROMPT }],
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', any = null, visible = null, chars = 0, cacheRead = 0, inputTokens = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        // Anthropic reports cache stats in message_start; OpenAI-backed models only in the final message_delta.
        const usage = ev.type === 'message_start' ? ev.message?.usage : ev.type === 'message_delta' ? ev.usage : null;
        if (usage) {
          cacheRead = Math.max(cacheRead, usage.cache_read_input_tokens ?? 0);
          inputTokens = Math.max(inputTokens, usage.input_tokens ?? 0);
        }
        if (ev.type !== 'content_block_delta') continue;
        const t = ev.delta?.type;
        if (t === 'thinking_delta' || t === 'text_delta') any ??= performance.now() - start;
        if (t === 'text_delta') { visible ??= performance.now() - start; chars += ev.delta.text.length; }
      } catch { /* keepalive */ }
    }
  }
  return { any, visible, total: performance.now() - start, chars, cacheRead, inputTokens };
}

const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);
const ms = (v) => (Number.isFinite(v) ? `${Math.round(v)}ms` : '—');

async function main() {
  if (!API_KEY) {
    console.error('CLIPROXYAPI_API_KEY not set.');
    process.exit(1);
  }
  console.log(`TTFT check — ${RUNS} run(s) each (+${WARMUP} warmup), proxy ${BASE_URL}`);
  console.log(`prompt: ${JSON.stringify(PROMPT)}`);
  if (CONTEXT) console.log(`context: ~${CONTEXT_TOKENS} tokens (${CONTEXT.length} chars) system prompt, cache_control ephemeral`);
  console.log();

  const rows = [];
  for (const { label, model } of TARGETS) {
    const anys = [], visibles = [], totals = [], cacheReads = [], inputs = [];
    let err = null;
    for (let i = 0; i < RUNS + WARMUP; i++) {
      let r = null;
      for (let attempt = 0; attempt < 3; attempt++) {   // retry transient proxy errors (503 etc.)
        try { r = await measure(model); err = null; break; }
        catch (e) { err = e.message; await new Promise((res) => setTimeout(res, 400)); }
      }
      if (!r) continue;   // all retries failed — skip this sample, keep going
      if (i < WARMUP) continue;   // discard cold-start runs
      if (r.any !== null) anys.push(r.any);
      if (r.visible !== null) visibles.push(r.visible);
      totals.push(r.total);
      cacheReads.push(r.cacheRead); inputs.push(r.inputTokens);
    }
    if (anys.length) err = null;   // got usable samples despite occasional errors
    rows.push({ label, anys, visibles, totals, err, cache: CONTEXT ? `${Math.round(mean(cacheReads))}/${Math.round(mean(inputs) + mean(cacheReads))}` : '' });
    process.stdout.write('.');   // progress
  }
  process.stdout.write('\n\n');

  printTable(rows);
  saveResults(rows);
}

/** One JSONL line per model per run, raw samples included, so later runs can be compared/re-aggregated. */
function saveResults(rows) {
  const run = { ts: new Date().toISOString(), host: hostname(), proxy: BASE_URL, prompt: PROMPT, runs: RUNS, warmup: WARMUP, context: CONTEXT_TOKENS, note: NOTE };
  const r0 = (a) => a.map(Math.round);
  const lines = rows.map(({ label, anys, visibles, totals, err }) =>
    JSON.stringify({ ...run, label, model: TARGETS.find((t) => t.label === label).model,
      anyMean: Math.round(mean(anys)) || null, anyP50: Math.round(pct(anys, 50)) || null, visMean: Math.round(mean(visibles)) || null,
      samples: { any: r0(anys), visible: r0(visibles), total: r0(totals) }, err }));
  appendFileSync(RESULTS_FILE, lines.join('\n') + '\n');
  console.log(`\nsaved ${lines.length} rows → ${RESULTS_FILE.pathname}`);
}

/** Fixed-width table renderer. cols: [{ key, header, align }]. */
function table(cols, data) {
  const widths = cols.map((c) => Math.max(c.header.length, ...data.map((r) => String(r[c.key] ?? '').length)));
  const line = (cells) => cells.map((c, i) => (cols[i].align === 'right' ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join('  ');
  const sep = widths.map((w) => '─'.repeat(w)).join('  ');
  const out = [line(cols.map((c) => c.header)), sep, ...data.map((r) => line(cols.map((c) => String(r[c.key] ?? ''))))];
  return out.map((l) => '  ' + l).join('\n');
}

function printTable(rows) {
  const ok = rows.filter((r) => !r.err && r.anys.length);
  const base = mean(ok.find((r) => r.label === 'haiku-4.5(none)')?.anys ?? []);

  // Detail table: first-any vs first-visible token, full stats per model.
  const detail = rows.map((r) => {
    if (r.err) return { model: r.label, anyMean: 'ERROR', anyP50: '', visMean: '', visP50: '', total: '', note: r.err.slice(0, 34) };
    const a = mean(r.anys);
    return {
      model: r.label,
      anyMean: ms(a),
      anyP50: ms(pct(r.anys, 50)),
      visMean: ms(mean(r.visibles)),
      visP50: ms(pct(r.visibles, 50)),
      total: ms(mean(r.totals)),
      note: Number.isFinite(base) ? `${(a / base).toFixed(2)}×` : '',
      cache: r.cache,
    };
  });
  console.log('TTFT per model  (any = first thinking-or-text token · visible = first answer token)');
  console.log(table(
    [
      { key: 'model', header: 'model' },
      { key: 'anyMean', header: 'any mean', align: 'right' },
      { key: 'anyP50', header: 'any p50', align: 'right' },
      { key: 'visMean', header: 'vis mean', align: 'right' },
      { key: 'visP50', header: 'vis p50', align: 'right' },
      { key: 'total', header: 'total', align: 'right' },
      { key: 'note', header: 'vs base', align: 'right' },
      ...(CONTEXT ? [{ key: 'cache', header: 'cached/in tok', align: 'right' }] : []),
    ],
    detail,
  ));

  // Ranking table: fastest first by mean first-any-token TTFT.
  const ranked = [...ok].sort((a, b) => mean(a.anys) - mean(b.anys)).map((r, i) => {
    const a = mean(r.anys);
    return { rank: `${i + 1}`, model: r.label, any: ms(a), vis: ms(mean(r.visibles)), rel: Number.isFinite(base) ? `${(a / base).toFixed(2)}×` : '' };
  });
  console.log('\nRanking (fastest first-token first)   base = haiku-4.5(none)');
  console.log(table(
    [
      { key: 'rank', header: '#' },
      { key: 'model', header: 'model' },
      { key: 'any', header: 'any TTFT', align: 'right' },
      { key: 'vis', header: 'visible TTFT', align: 'right' },
      { key: 'rel', header: 'vs base', align: 'right' },
    ],
    ranked,
  ));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
