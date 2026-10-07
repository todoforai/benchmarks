"""Per-bash-call timing for a todo: requested timeout vs actual duration. Usage: bash_timings.py <todo.json>"""
import json, sys

d = json.load(open(sys.argv[1]))
ms = d.get("messages", d) if isinstance(d, dict) else d
ms = sorted(ms, key=lambda m: m.get("createdAt") or 0)
t0 = ms[0]["createdAt"]
for i, m in enumerate(ms):
    if m.get("role") != "assistant":
        continue
    nxt = next((x for x in ms[i + 1:] if x.get("role") == "user"), None)
    for b in m.get("blocks") or []:
        if b.get("type") != "bash":
            continue
        start = (m["createdAt"] - t0) / 1000
        end = ((nxt or m)["createdAt"] - t0) / 1000
        meta = {k: b.get(k) for k in ("timeout", "status", "exitCode", "pid") if b.get(k) is not None}
        cmd = " ".join((b.get("cmd") or "").split())[:90]
        print(f"{start:6.0f}s  dur~{end - start:5.0f}s  {meta}  {cmd}")
