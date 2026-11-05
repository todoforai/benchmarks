import { readFileSync, readdirSync, existsSync } from 'node:fs';
const key = readFileSync('dev_api_keys.txt','utf8').split('\n')[0].split(/\s+/)[0];
const jobs = { sol: ['todoforai-gpt-6.1-sol-app-sol__2026-11-05__15-26-40'],
  opus: ['todoforai-claude-opus-5.5-app__2026-10-25__23-54-53','todoforai-claude-opus-5.5-app__2026-10-26__00-27-40','todoforai-claude-opus-5.5-app__2026-10-26__10-21-19','todoforai-claude-opus-5.5-app__2026-10-26__18-10-14'] };
const trials = (js) => { const m = new Map(); for (const j of js) for (const t of readdirSync('jobs/'+j,{withFileTypes:true})) {
  if (!t.isDirectory()) continue; const d=`jobs/${j}/${t.name}`, f=d+'/agent/todoforai-cli.txt';
  if (!existsSync(f)||!existsSync(d+'/result.json')) continue;
  const id = readFileSync(f,'utf8').match(/todofor\.ai\/t\/([0-9a-f-]{36})/i); if(!id) continue;
  const res = JSON.parse(readFileSync(d+'/result.json','utf8'));
  if (res.exception_info?.exception_type==='CancelledError') continue;
  const r = existsSync(d+'/verifier/reward.txt') ? readFileSync(d+'/verifier/reward.txt','utf8').trim() : '-';
  m.set(t.name.replace(/__[A-Za-z0-9]+$/,''), {id:id[1], r}); } return m; };
const S = trials(jobs.sol), O = trials(jobs.opus);
const tok = async (todo) => { const t={in:0,out:0,cr:0,cw:0,calls:0,models:new Set()}; const seen=new Set(), q=[todo];
  while(q.length){ const id=q.pop(); if(seen.has(id))continue; seen.add(id);
    const r=await fetch(`https://api.todofor.ai/api/v1/todos/${id}/messages?limit=500`,{headers:{'x-api-key':key}}); if(!r.ok)continue;
    const walk=o=>{ if(!o||typeof o!=='object')return; if(Array.isArray(o))return o.forEach(walk);
      if(o.subTodoId)q.push(o.subTodoId); const e=o.extras;
      if(e&&(e.inputTokens!=null||e.outputTokens!=null)){t.in+=e.inputTokens||0;t.out+=e.outputTokens||0;t.cr+=e.cacheReadTokens||0;t.cw+=e.cacheWriteTokens||0;t.calls++;if(e.model)t.models.add(e.model)}
      for(const v of Object.values(o))walk(v); };
    walk((await r.json()).messages); } return t; };
const P = { sol:{in:1,out:5,cr:0.05,cw:1.25}, opus:{in:5,out:25,cr:0.5,cw:6.25} };
const cost=(t,p)=>(t.in*p.in+t.out*p.out+t.cr*p.cr+t.cw*p.cw)/1e6;
const K=n=>(n/1e3).toFixed(0)+'k'; const rows=[]; const tot={sol:{in:0,out:0,cr:0,cw:0,calls:0,$:0},opus:{in:0,out:0,cr:0,cw:0,calls:0,$:0}};
for (const [task,s] of S) { const o=O.get(task); if(!o) continue;
  const ts=await tok(s.id), to=await tok(o.id);
  for (const [k,t] of [['sol',ts],['opus',to]]) { for (const f of ['in','out','cr','cw','calls']) tot[k][f]+=t[f]; tot[k].$+=cost(t,P[k]); }
  rows.push(`| ${task} | ${s.r} / ${o.r} | ${ts.calls} / ${to.calls} | ${K(ts.in+ts.cr+ts.cw)} / ${K(to.in+to.cr+to.cw)} | ${K(ts.out)} / ${K(to.out)} | $${cost(ts,P.sol).toFixed(2)} / $${cost(to,P.opus).toFixed(2)} | ${[...to.models].join(',').replace(/anthropic:anthropic\//g,'')} |`); }
console.log('| task | pass sol/opus | calls | input (incl cache) | output | cost | opus models |\n|---|---|---|---|---|---|---|\n'+rows.join('\n'));
for (const k of ['sol','opus']) { const t=tot[k]; console.log(k, `calls ${t.calls} in ${K(t.in)} cacheR ${K(t.cr)} cacheW ${K(t.cw)} out ${K(t.out)} $${t.$.toFixed(2)}`); }
