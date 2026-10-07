"""For each todoforai trial dir, find its todo id and count which model answered (via runMeta extras.model).
Usage: ours_models.py <job-dir>..."""
import json, sys, glob, re, subprocess, os
from collections import Counter

K = subprocess.check_output(
    "head -1 /mnt/c/repo/todoforai/benchmarks/terminal-bench/dev_api_keys.txt | awk '{print $1}'",
    shell=True, text=True).strip()

def todo_id(d):
    for f in glob.glob(d + "/**/*", recursive=True):
        if os.path.isfile(f):
            try:
                t = open(f, errors="ignore").read()
            except Exception:
                continue
            m = re.search(r"todofor\.ai/t/([0-9a-f-]{36})", t)
            if m:
                return m.group(1)
    return None

def models_for(tid):
    import urllib.request
    req = urllib.request.Request(
        f"https://api.todofor.ai/api/v1/todos/{tid}/messages?limit=400",
        headers={"x-api-key": K})
    d = json.load(urllib.request.urlopen(req, timeout=30))
    ms = d if isinstance(d, list) else d.get("messages", d.get("items", []))
    c = Counter()
    for m in ms:
        if not isinstance(m, dict) or m.get("role") != "assistant":
            continue
        for ev in (m.get("runMeta") or []):
            mo = ((ev.get("extras") or {}).get("model")) if isinstance(ev, dict) else None
            if mo:
                c[mo.split("(")[0].split("/")[-1]] += 1
    return c

for job in sys.argv[1:]:
    for d in sorted(glob.glob(job + "/*/")):
        task = os.path.basename(d.rstrip("/")).split("__")[0]
        tid = todo_id(d)
        if not tid:
            print(f"{task:34} NO-TODO-ID"); continue
        try:
            c = models_for(tid)
        except Exception as e:
            print(f"{task:34} ERR {e}"); continue
        has48 = any("4.8" in k or "4-8" in k for k in c)
        if has48:
            try:
                r = json.load(open(d + "result.json")); rw = (r.get("verifier_result") or {}).get("rewards", {}).get("reward")
            except Exception:
                rw = None
            print(f"{task:34} pass={rw}  {dict(c)}")
