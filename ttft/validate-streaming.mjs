// Sanity check for ttft-check.mjs: 150-word answer, interleaved models. Proves streaming (total >> TTFT,
// many deltas), confirms served model, and exposes thinking time a trivial prompt hides.
// Env: PK = proxy key, OC = OPENCODE_API_KEY (only for direct targets). Edit `targets` to choose models.
// Long output + interleaved order: proves streaming (total >> TTFT, many deltas) and removes time-drift bias.
const PROMPT = 'Write exactly 150 words about the history of bridges. No preamble.';
async function viaProxy(model) {
  const t0 = performance.now();
  const res = await fetch('http://localhost:8317/v1/messages', { method: 'POST', signal: AbortSignal.timeout(90_000),
    headers: { 'x-api-key': process.env.PK, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'x-claude-code-session-id': 'val-' + Math.random() },
    body: JSON.stringify({ model, max_tokens: 2048, stream: true, messages: [{ role: 'user', content: PROMPT }] }) });
  return read(res, t0, (ev) => ev.type === 'content_block_delta' ? { think: ev.delta?.type === 'thinking_delta', text: ev.delta?.text } : null, (ev) => ev.message?.model);
}
async function direct(model) {
  const t0 = performance.now();
  const res = await fetch('https://opencode.ai/zen/go/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(90_000),
    headers: { authorization: `Bearer ${process.env.OC}`, 'x-opencode-session': 'val-direct', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 2048, stream: true, reasoning_effort: 'low', messages: [{ role: 'user', content: PROMPT }] }) });
  return read(res, t0, (ev) => { const d = ev.choices?.[0]?.delta; return d ? { think: !!d.reasoning_content, text: d.content } : null; }, (ev) => ev.model);
}
async function read(res, t0, pick, modelOf) {
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '', any = null, vis = null, deltas = 0, words = 0, model = null;
  for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!l.startsWith('data:') || l.includes('[DONE]')) continue;
      let ev; try { ev = JSON.parse(l.slice(5)); } catch { continue; }
      model ??= modelOf(ev) ?? null;
      const d = pick(ev); if (!d) continue;
      if (d.think || d.text) { any ??= performance.now() - t0; deltas++; }
      if (d.text) { vis ??= performance.now() - t0; words += d.text.split(/\s+/).filter(Boolean).length; } } }
  return { any, vis, total: performance.now() - t0, deltas, words, model };
}
const targets = [['proxy haiku(none)', () => viaProxy('claude-haiku-4-5-20251001(none)')], ['proxy glm-5.3(none)', () => viaProxy('glm-5.3(none)')],
                 ['proxy sonnet-5(none)', () => viaProxy('claude-sonnet-5(none)')]];
const out = Object.fromEntries(targets.map(([n]) => [n, []]));
for (let round = 0; round < 7; round++) for (const [n, f] of targets) {   // interleaved
  try { const r = await f(); if (round > 0) out[n].push(r); } catch (e) { console.log(n, 'ERR', e.message); } }
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return Math.round(s[s.length >> 1]); };
for (const [n, rs] of Object.entries(out)) console.log(n.padEnd(20), `any p50 ${med(rs.map(r => r.any))}ms  vis p50 ${med(rs.map(r => r.vis))}ms  total p50 ${med(rs.map(r => r.total))}ms  deltas p50 ${med(rs.map(r => r.deltas))}  words ${med(rs.map(r => r.words))}  model=${rs[0]?.model}  n=${rs.length}`);
