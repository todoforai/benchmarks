// GLM-5.3(low) thinking length is bimodal: prints visible-TTFT/thinking-chars per request for
// UA x session combinations (neither explains it). Env: PK = proxy key.
const PROMPT = 'Write exactly 150 words about the history of bridges. No preamble.';
async function run(model, ua, session) {
  const t0 = performance.now();
  const h = { 'x-api-key': process.env.PK, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'x-claude-code-session-id': session };
  if (ua) h['user-agent'] = 'claude-cli/1.0.0 (external, cli)';
  const res = await fetch('http://localhost:8317/v1/messages', { method: 'POST', headers: h, signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({ model, max_tokens: 2048, stream: true, messages: [{ role: 'user', content: PROMPT }] }) });
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '', vis = null, think = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!l.startsWith('data:')) continue; let ev; try { ev = JSON.parse(l.slice(5)); } catch { continue; }
      if (ev.delta?.type === 'thinking_delta') think += ev.delta.thinking.length;
      if (ev.delta?.type === 'text_delta') vis ??= Math.round(performance.now() - t0); } }
  return `${vis}ms/${think}ch`;
}
const fixed = 'fixed-' + Date.now();
for (const [name, ua, sess] of [['ua+fixed session', true, () => fixed], ['no-ua+fresh session', false, () => 'f' + Math.random()], ['ua+fresh session', true, () => 'f' + Math.random()], ['no-ua+fixed session', false, () => fixed + 'b']]) {
  const r = []; for (let i = 0; i < 4; i++) r.push(await run('glm-5.3(low)', ua, sess()));
  console.log(name.padEnd(22), r.join('  '));
}
