import json,glob,sys
B="/mnt/c/repo/todoforai/benchmarks/terminal-bench/"
tasks=[t.strip() for t in open(B+"tasks_all.txt") if t.strip()]
cols={"CC":["claude-code-claude-opus-5-5-high__2026-10-05__15-26-07"],
 "Codex":["codex-claude-opus-5-5-high__2026-10-06__16-26-05","codex-claude-opus-5-5-high__2026-10-06__23-33-55","codex-claude-opus-5-5-high__2026-10-07__03-34-51"],
 "ours_old":["todoforai-claude-opus-5.5-app__2026-10-05__22-21-25"],
 "ours_new":["todoforai-claude-opus-5.5-app__2026-10-06__21-04-34","todoforai-claude-opus-5.5-app__2026-10-06__22-51-17","todoforai-claude-opus-5.5-app__2026-10-07__01-09-13"]}
ab={"AgentTimeoutError":"timeout","AgentSafetyRefusalError":"refusal","NonZeroAgentExitCodeError":"exit≠0","VerifierTimeoutError":"verifier-timeout"}
def get(jobs,t):
    for j in jobs:
        ds=sorted(glob.glob(f"{B}jobs/{j}/{t}__*/result.json"))
        if ds:
            x=json.load(open(ds[-1])); rw=(x.get("verifier_result") or {}).get("rewards",{}).get("reward")
            e=(x.get("exception_info") or {}).get("exception_type")
            return 1 if rw==1.0 else 0, ab.get(e,e or "")
    return None,"missing"
tot={c:0 for c in cols}; rows=[]
for t in tasks:
    r=[get(cols[c],t) for c in cols]
    for c,(v,_) in zip(cols,r): tot[c]+=v or 0
    if any(v!=1 for v,_ in r): rows.append((t,r))
print(tot)
for t,r in rows: print(t, " | ".join(f"{v}{(' '+e) if e else ''}" for v,e in r))
