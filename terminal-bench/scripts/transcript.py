#!/usr/bin/env python3
"""What did the agent do in a todo? One line per block: elapsed, type, cmd/path/text.
Usage: python3 scripts/transcript.py <todoId> [--full]"""
import json, os, sys, urllib.request

root = os.path.dirname(os.path.abspath(__file__))
key = os.environ.get("TODOFORAI_API_KEY") or next(
    l.split()[0] for l in open(os.path.join(root, "..", "dev_api_keys.txt")) if l.strip() and not l.startswith("#"))
full = "--full" in sys.argv
req = urllib.request.Request(f"https://api.todofor.ai/api/v1/todos/{sys.argv[1]}/messages", headers={"x-api-key": key})
msgs = json.load(urllib.request.urlopen(req))
msgs = msgs.get("messages", msgs) if isinstance(msgs, dict) else msgs

def short(s, n):
    s = " ".join(str(s or "").split())
    return s if full or len(s) <= n else s[:n] + "…"

t0 = msgs[0].get("createdAt") or 0
for m in msgs:
    rel = f"{((m.get('createdAt') or t0) - t0) / 1000:6.0f}s"
    if m.get("role") == "user":
        print(f"{rel} USER   {short(m.get('content'), 300)}")
        continue
    for b in m.get("blocks") or []:
        bt = b.get("type", "?")
        body = b.get("cmd") or b.get("path") or b.get("error_message") or b.get("content")
        print(f"{rel} {bt[:6]:6} {short(body, 600 if bt == 'text' else 200)}")
