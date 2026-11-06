"""Thinking/reasoning share of output tokens, CC (jsonl deduped by message id) vs Codex (last token_count per rollout) on the top5cost tasks. Ours comes from API runMeta extras.thinkingTokens (see RUNLOG 10-07 top5cost)."""
import json,glob,os
os.chdir("/mnt/c/repo/todoforai/benchmarks/terminal-bench/jobs")
T=["dna-assembly","filter-js-from-html","make-doom-for-mips","schemelike-metacircular-eval","winning-avg-corewars"]
CC="claude-code-claude-opus-5-5-high__2026-10-05__15-26-07"
CX=["codex-claude-opus-5-5-high__2026-10-06__16-26-05","codex-claude-opus-5-5-high__2026-10-06__23-33-55","codex-claude-opus-5-5-high__2026-10-07__03-34-51"]
def rew(d):
  try: return json.load(open(d+"/result.json"))["verifier_result"]["rewards"]["reward"]
  except Exception: return None
tot={"cc":[0,0],"cx":[0,0]}
for t in T:
  d=sorted(glob.glob(f"{CC}/{t}__*"))[0]; seen={}; raw=0
  for f in glob.glob(d+"/agent/sessions/projects/**/*.jsonl",recursive=True):
    for l in open(f):
      try: x=json.loads(l)
      except Exception: continue
      if x.get("type")!="assistant": continue
      m=x["message"]; u=m.get("usage") or {}; raw+=1
      seen[m.get("id")]=(u.get("output_tokens",0),(u.get("output_tokens_details") or {}).get("thinking_tokens",0))
  o=sum(v[0] for v in seen.values()); th=sum(v[1] for v in seen.values())
  tot["cc"][0]+=o; tot["cc"][1]+=th
  print(f"CC    {t:30s} r={rew(d)} msgs={len(seen):4d}(raw {raw}) out={o:7d} think={th:7d} share={th/max(o,1):.1%}")
for t in T:
  ds=[d for j in CX for d in sorted(glob.glob(f"{j}/{t}__*"))]
  d=ds[-1]; fs=glob.glob(d+"/agent/sessions/**/*.jsonl",recursive=True); o=r=0
  for f in fs:
    last=None
    for l in open(f):
      if '"token_count"' in l:
        x=json.loads(l); i=(x["payload"].get("info") or {}).get("total_token_usage")
        if i: last=i
    if last: o+=last["output_tokens"]; r+=last["reasoning_output_tokens"]
  tot["cx"][0]+=o; tot["cx"][1]+=r
  print(f"Codex {t:30s} r={rew(d)} job={d.split('__')[1][:10]}.. out={o:7d} reasoning={r:7d} share={r/max(o,1):.1%}")
for k,(o,th) in tot.items(): print(f"TOTAL {k}: out={o} think={th} share={th/o:.1%}")
