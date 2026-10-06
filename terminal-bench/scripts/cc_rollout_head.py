#!/usr/bin/env python3
"""Dump what Claude Code put in front of the model for one trial: the
`prompt_snapshot` system prompt blocks, the system-reminder attachments injected
around the first user turn, and the first assistant usage.
Usage: cc_rollout_head.py <job>/<task>__<id> > out.md"""
import glob, json, sys

root = sys.argv[1]
f = sorted(glob.glob(root + "/agent/sessions/projects/**/*.jsonl", recursive=True))[0]
FENCE = "```"
snap_done = usage_done = False
reminders = []
for line in open(f):
    r = json.loads(line)
    t = r.get("type")
    if t == "attachment":
        a = r["attachment"]
        if a.get("type") == "prompt_snapshot" and not snap_done:
            snap_done = True
            blocks = a["systemPrompt"]
            print(f"# Claude Code {r.get('version')} — what the model sees ({root.split('/')[-1]})\n")
            print(f"## systemPrompt: {len(blocks)} blocks, {sum(len(b) for b in blocks)} B total\n")
            for i, b in enumerate(blocks):
                print(f"### block {i} ({len(b)} B)\n\n{FENCE}\n{b}\n{FENCE}\n")
            extra = {k: v for k, v in a.items() if k != "systemPrompt"}
            if extra:
                print("### other snapshot fields\n\n" + FENCE + "json\n" + json.dumps(extra, indent=1)[:3000] + "\n" + FENCE + "\n")
        elif r.get("rendered") and not usage_done:
            for x in r["rendered"]:
                reminders.append((a.get("type"), x.get("content", "")))
    elif t == "assistant" and not usage_done:
        usage_done = True
        print("## injected system-reminders before/at first turn\n")
        for kind, c in reminders:
            print(f"### {kind} ({len(c)} B)\n\n{FENCE}\n{c}\n{FENCE}\n")
        print("## first assistant usage\n\n" + FENCE + "json\n" + json.dumps(r["message"].get("usage"), indent=1) + "\n" + FENCE)
        break
