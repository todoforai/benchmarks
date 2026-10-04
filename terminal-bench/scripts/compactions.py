#!/usr/bin/env python3
"""Context compactions per trial: python3 scripts/compactions.py <job-dir>...

A compaction is detected as a drop of the provider-reported contextTokens
(runMeta[].extras.contextTokens) to <60% of the previous call. The summary text
itself is not retrievable here: it lives only in the agent's in-memory history
(and /context/<id>/summaries, which is empty for --isolated runs)."""
import glob, os, re, sys, urllib.request, json

API = "https://api.todofor.ai/api/v1"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = os.environ.get("TODOFORAI_API_KEY") or next(
    l.split()[0] for l in open(os.path.join(HERE, "dev_api_keys.txt")) if l.strip() and not l.startswith("#"))


def get(path):
    req = urllib.request.Request(API + path, headers={"x-api-key": KEY})
    return json.load(urllib.request.urlopen(req, timeout=60))


def all_messages(todo):
    out, before = [], None
    while True:
        d = get(f"/todos/{todo}/messages?limit=200" + (f"&before={before}" if before else ""))
        page = d.get("messages") or []
        out = page + out
        if not d.get("hasMore") or not page:
            return out
        before = page[0]["id"]


def context_series(msgs):
    seq = []
    for m in msgs:
        metas = m.get("runMeta")
        for r in metas if isinstance(metas, list) else [metas or {}]:
            if isinstance(r, dict):
                t = (r.get("extras") or {}).get("contextTokens") or r.get("contextTokens")
                if t:
                    seq.append(t)
    return seq


def main():
    for job in sys.argv[1:]:
        for trial in sorted(glob.glob(os.path.join(job, "*/"))):
            log = os.path.join(trial, "agent", "todoforai-cli.txt")
            if not os.path.exists(log):
                continue
            m = re.search(rb"todofor\.ai/t/([0-9a-f-]{36})", open(log, "rb").read())
            if not m:
                continue
            todo = m.group(1).decode()
            seq = context_series(all_messages(todo))
            drops = [f"{a // 1000}K->{b // 1000}K" for a, b in zip(seq, seq[1:]) if b < a * 0.6 and a > 100_000]
            name = os.path.basename(trial.rstrip("/")).split("__")[0]
            print(f"{os.path.basename(job)[:20]:20} {name:28} max={max(seq, default=0) // 1000:>4}K "
                  f"compactions={len(drops)} {' '.join(drops)}")


if __name__ == "__main__":
    main()
