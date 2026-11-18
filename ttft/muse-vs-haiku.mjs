#!/usr/bin/env node
// TTFT for voice-loop LLM candidates: Muse (Meta Responses API), Haiku (CLIProxy), and fast OpenAI-compatible APIs, interleaved.
// any = first reasoning-or-text token, visible = first answer token (what TTS can speak), total = stream end.
// Env: MODEL_API_KEY (handsfree/.env), CLIPROXYAPI_API_KEY (default: ~/cliproxyapi/config.yaml),
//      STLZ_API_KEY (tfa-vault api/systalyze), CEREBRAS/GROQ/XAI_API_KEY (agent/.env.production), GEMINI/OPENAI_API_KEY (backend/.env).
// Usage: node benchmarks/ttft/muse-vs-haiku.mjs [--runs 8] [--only haiku,groq] [--prompt "..."] [--note "..."]
import { appendFileSync, readFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('--runs', '8')), PROMPT = arg('--prompt', 'Say "ok" and nothing else.'), NOTE = arg('--note', '');
const META_KEY = process.env.MODEL_API_KEY;
const PROXY_KEY = process.env.CLIPROXYAPI_API_KEY ?? readFileSync(`${homedir()}/cliproxyapi/config.yaml`, 'utf8').match(/^api-keys:\s*\n\s*-\s*"?([^"\n]+)"?/m)?.[1];

async function sse(res, t0, onEvent) {
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  const r = { any: null, visible: null, total: null }, rd = res.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!l.startsWith('data:')) continue;
      let ev; try { ev = JSON.parse(l.slice(5)); } catch { continue; }
      const k = onEvent(ev), t = performance.now() - t0;
      if (k) r.any ??= t;
      if (k === 'text') r.visible ??= t;
    }
  }
  r.total = performance.now() - t0;
  return r;
}

const muse = (model, effort) => async () => {
  const t0 = performance.now();
  const res = await fetch('https://api.meta.ai/v1/responses', { method: 'POST', signal: AbortSignal.timeout(60_000),
    headers: { authorization: `Bearer ${META_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: PROMPT, stream: true, reasoning: { effort } }) });
  return sse(res, t0, (ev) => ev.type === 'response.output_text.delta' ? 'text'
    : /reasoning.*delta/.test(ev.type ?? '') ? 'think' : null);
};

const claude = (model) => async () => {
  const t0 = performance.now();
  const res = await fetch('http://localhost:8317/v1/messages', { method: 'POST', signal: AbortSignal.timeout(60_000),
    headers: { 'x-api-key': PROXY_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json',
      'user-agent': 'claude-cli/1.0.0 (external, cli)', 'x-claude-code-session-id': `mvh-${model}` },
    body: JSON.stringify({ model, max_tokens: 2048, stream: true, messages: [{ role: 'user', content: PROMPT }] }) });
  return sse(res, t0, (ev) => ev.type !== 'content_block_delta' ? null
    : ev.delta?.type === 'text_delta' ? 'text' : ev.delta?.type === 'thinking_delta' ? 'think' : null);
};

// OpenAI-compatible chat/completions (Cerebras, Groq, Gemini, OpenAI, xAI). `extra` turns reasoning off/min.
const oai = (base, key, model, extra = {}) => async () => {
  const t0 = performance.now();
  const res = await fetch(`${base}/chat/completions`, { method: 'POST', signal: AbortSignal.timeout(60_000),
    headers: { authorization: `Bearer ${process.env[key]}`, 'content-type': 'application/json', 'x-opencode-session': 'ttft' },
    body: JSON.stringify({ model, stream: true, messages: [{ role: 'user', content: PROMPT }], ...extra }) });
  return sse(res, t0, (ev) => { const d = ev.choices?.[0]?.delta; return d?.content ? 'text' : (d?.reasoning || d?.reasoning_content) ? 'think' : null; });
};
const SZ = 'https://inference.systalyze.com/v1', OC = 'https://opencode.ai/zen/go/v1';
const CB = 'https://api.cerebras.ai/v1', GQ = 'https://api.groq.com/openai/v1', GM = 'https://generativelanguage.googleapis.com/v1beta/openai',
  OA = 'https://api.openai.com/v1', XA = 'https://api.x.ai/v1';
const ALL = {
  'muse-spark-1.3(minimal)': muse('muse-spark-1.3', 'minimal'),
  'muse-ember-1.0(minimal)': muse('muse-ember-1.0', 'minimal'),
  'haiku-4.5(none)': claude('claude-haiku-4-5-20251001(none)'),
  'haiku-5.5(none)': claude('claude-haiku-5-5(none)'),
  'cerebras/gpt-oss-120b(low)': oai(CB, 'CEREBRAS_API_KEY', 'gpt-oss-120b', { reasoning_effort: 'low' }),
  'cerebras/qwen-3.8-27b': oai(CB, 'CEREBRAS_API_KEY', 'qwen-3.8-27b', { reasoning_effort: 'none' }),
  'groq/gpt-oss-20b(low)': oai(GQ, 'GROQ_API_KEY', 'openai/gpt-oss-20b', { reasoning_effort: 'low' }),
  'groq/gpt-oss-120b(low)': oai(GQ, 'GROQ_API_KEY', 'openai/gpt-oss-120b', { reasoning_effort: 'low' }),
  'groq/qwen3.8-27b(none)': oai(GQ, 'GROQ_API_KEY', 'qwen/qwen3.8-27b', { reasoning_effort: 'none' }),
  'gemini-3.5-flash-lite(low)': oai(GM, 'GEMINI_API_KEY', 'gemini-3.5-flash-lite', { reasoning_effort: 'low' }),
  'gemini-3.1-flash-lite(none)': oai(GM, 'GEMINI_API_KEY', 'gemini-3.1-flash-lite', { reasoning_effort: 'none' }),
  'gemini-3.8-flash(none)': oai(GM, 'GEMINI_API_KEY', 'gemini-3.8-flash', { reasoning_effort: 'none' }),
  'gemini-4-hydrogen(none)': oai(GM, 'GEMINI_API_KEY', 'gemini-4-hydrogen', { reasoning_effort: 'none' }),
  'gemini-4-hydrogen(low)': oai(GM, 'GEMINI_API_KEY', 'gemini-4-hydrogen', { reasoning_effort: 'low' }),
  'gemini-4-carbon(none)': oai(GM, 'GEMINI_API_KEY', 'gemini-4-carbon', { reasoning_effort: 'none' }),
  'openai/gpt-6-luna(none)': oai(OA, 'OPENAI_API_KEY', 'gpt-6-luna', { reasoning_effort: 'none' }),
  'openai/gpt-6-luna(low)': oai(OA, 'OPENAI_API_KEY', 'gpt-6-luna', { reasoning_effort: 'low' }),
  'openai/gpt-5.6-luna(none)': oai(OA, 'OPENAI_API_KEY', 'gpt-5.6-luna', { reasoning_effort: 'none' }),
  'openai/gpt-6.1-terra(none)': oai(OA, 'OPENAI_API_KEY', 'gpt-6.1-terra', { reasoning_effort: 'none' }),
  'opencode/kimi-k3': oai(OC, 'OPENCODE_API_KEY', 'kimi-k3'),
  'opencode/kimi-k3(off)': oai(OC, 'OPENCODE_API_KEY', 'kimi-k3', { thinking: { type: 'disabled' } }),
  'opencode/glm-5.3(off)': oai(OC, 'OPENCODE_API_KEY', 'glm-5.3', { thinking: { type: 'disabled' } }),
  'opencode/glm-5.3': oai(OC, 'OPENCODE_API_KEY', 'glm-5.3'),
  'opencode/glm-5.3-flash': oai(OC, 'OPENCODE_API_KEY', 'glm-5.3-flash'),
  'systalyze/kimi-k3': oai(SZ, 'STLZ_API_KEY', 'moonshotai/Kimi-K3'),
  'systalyze/muse-spark-open': oai(SZ, 'STLZ_API_KEY', 'meta-models/Muse-Spark-Open-816B-A42B-NVFP4'),
  'systalyze/glm-5.3': oai(SZ, 'STLZ_API_KEY', 'zai-org/GLM-5.3'),
  'systalyze/glm-5.3-flash': oai(SZ, 'STLZ_API_KEY', 'zai-org/GLM-5.3-Flash'),
  'systalyze/qwen3.8-27b': oai(SZ, 'STLZ_API_KEY', 'Qwen/Qwen3.8-27B'),
  'openai/gpt-4.1-mini': oai(OA, 'OPENAI_API_KEY', 'gpt-4.1-mini'),
  'openai/gpt-5.4-mini(none)': oai(OA, 'OPENAI_API_KEY', 'gpt-5.4-mini', { reasoning_effort: 'none' }),
  'xai/grok-4.20-non-reasoning': oai(XA, 'XAI_API_KEY', 'grok-4.20-0309-non-reasoning'),
};
// --or "model@providerTag[:effort],..." adds OpenRouter targets pinned to one provider (no fallback).
// effort default `off` = reasoning disabled; else reasoning.effort (minimal/low/...).
for (const spec of arg('--or', '').split(',').filter(Boolean)) {
  const [model, rest] = spec.split('@'), [tag, effort = 'off'] = rest.split(':');
  ALL[`or/${model.split('/')[1]}@${tag}(${effort})`] = oai('https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY', model, {
    provider: { only: [tag], allow_fallbacks: false },
    reasoning: effort === 'off' ? { enabled: false } : { effort } });
}
const ONLY = arg('--only', '').split(',').filter(Boolean);
const targets = Object.fromEntries(Object.entries(ALL).filter(([k]) => !ONLY.length || ONLY.some((o) => k.includes(o))));
const out = Object.fromEntries(Object.keys(targets).map((k) => [k, { any: [], visible: [], total: [], err: null }]));
for (let round = 0; round <= RUNS; round++)            // round 0 = warmup; interleaved removes time-drift bias
  for (const [name, f] of Object.entries(targets)) {
    try { const r = await f(); if (round) for (const k of ['any', 'visible', 'total']) if (r[k] != null) out[name][k].push(Math.round(r[k])); }
    catch (e) { out[name].err = e.message; }
    process.stdout.write('.');
  }
const p = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : '—'; };
console.log(`\nprompt: ${JSON.stringify(PROMPT)}  n=${RUNS}\n| model | any p50 | visible p50 | visible p90 | total p50 |\n|---|---|---|---|---|`);
for (const [n, s] of Object.entries(out))
  console.log(`| ${n} | ${p(s.any, .5)} | **${p(s.visible, .5)}** | ${p(s.visible, .9)} | ${p(s.total, .5)} |${s.err ? ' err: ' + s.err : ''}`);
const run = { ts: new Date().toISOString(), host: hostname(), script: 'muse-vs-haiku', prompt: PROMPT, runs: RUNS, warmup: 1, note: NOTE };
appendFileSync(new URL('./results.jsonl', import.meta.url), Object.entries(out).map(([label, s]) =>
  JSON.stringify({ ...run, label, anyP50: p(s.any, .5), visP50: p(s.visible, .5), samples: s, err: s.err }) + '\n').join(''));
