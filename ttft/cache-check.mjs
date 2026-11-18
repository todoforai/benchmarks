#!/usr/bin/env node
// Prompt-cache check per OpenRouter provider: send the SAME ~5k-token system prompt N times, pinned to
// one provider, and read what was actually billed (usage.prompt_tokens_details.cached_tokens, usage.cost)
// plus TTFT. Measured, not taken from the OpenRouter pricing page (a listed cache price ≠ a working cache).
// Usage: node benchmarks/ttft/cache-check.mjs "model@providerTag,..." [--calls 4]
// Env: OPENROUTER_API_KEY.
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const CALLS = Number(arg('--calls', '4'));
const SYS = `run-${Date.now()} ` + Array.from({ length: 400 }, (_, i) => `Fact ${i}: ledger ${i * 7} sums to ${(i * 31) % 997}.`).join(' ');
async function call(model, tag) {
  const t0 = performance.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(60_000),
    headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 16, stream: true, stream_options: { include_usage: true }, reasoning: { enabled: false },
      provider: { only: [tag], allow_fallbacks: false },
      messages: [{ role: 'system', content: SYS }, { role: 'user', content: 'Reply with the word ok.' }] }) });
  if (!res.ok) return { err: `${res.status} ${(await res.text()).slice(0, 100)}` };
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '', ttft = null, usage = null;
  for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!l.startsWith('data:') || l.includes('[DONE]')) continue; let ev; try { ev = JSON.parse(l.slice(5)); } catch { continue; }
      if (ev.choices?.[0]?.delta?.content) ttft ??= performance.now() - t0; if (ev.usage) usage = ev.usage; } }
  return { ttft: Math.round(ttft), prompt: usage?.prompt_tokens, cached: usage?.prompt_tokens_details?.cached_tokens ?? 0, cost: usage?.cost };
}
console.log('| model@provider | call | ttft ms | prompt | cached | cost $ |\n|---|---|---|---|---|---|');
for (const spec of process.argv[2].split(',')) {
  const [model, tag] = spec.split('@');
  for (let c = 1; c <= CALLS; c++) {
    const r = await call(model, tag);
    console.log(`| ${spec} | ${c} | ${r.err ?? r.ttft} | ${r.prompt ?? ''} | ${r.cached ?? ''} | ${r.cost?.toFixed(6) ?? ''} |`);
    await new Promise((s) => setTimeout(s, 1000));
  }
}
