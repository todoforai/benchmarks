#!/usr/bin/env python3
"""Dump what Codex CLI put in front of the model for one trial: base_instructions,
the developer message, environment/user messages, task head, first-turn token usage.
Usage: codex_rollout_head.py <job>/<task>__<id> > out.md"""
import glob, json, sys

root = sys.argv[1]
f = sorted(glob.glob(root + "/agent/sessions/**/*.jsonl", recursive=True))[0]
FENCE = "```"
for line in open(f):
    r = json.loads(line)
    t, p = r.get("type"), r.get("payload", {})
    if t == "session_meta":
        bi = p["base_instructions"]["text"]
        print(f"# Codex CLI {p.get('cli_version')} — what the model sees ({root.split('/')[-1]})\n")
        print(f"model_provider={p.get('model_provider')} model={p.get('model')}\n")
        print(f"## base_instructions ({len(bi)} B)\n\n{FENCE}\n{bi}\n{FENCE}\n")
    elif t == "response_item" and p.get("type") == "message" and p.get("role") in ("developer", "user"):
        role = p["role"]
        txt = "\n".join(c.get("text", "") for c in p["content"])
        if role == "user" and not txt.startswith("<"):
            print(f"## task (user, {len(txt)} B)\n\n{FENCE}\n{txt[:600]}...\n{FENCE}\n")
        else:
            print(f"## {role} message ({len(txt)} B)\n\n{FENCE}\n{txt}\n{FENCE}\n")
    elif t == "token_usage_record":
        print("## first turn token usage\n\n" + FENCE + "json\n" + json.dumps(p.get("turn_token_usage") or p.get("usage"), indent=1) + "\n" + FENCE)
        break
