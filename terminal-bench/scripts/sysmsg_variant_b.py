"""Variant B: add a persistent-Python-session (REPL/ipykernel) line to the bench `app`
agent's sysmsg, for the video-processing A/B. Usage: python3 scripts/sysmsg_variant_b.py [restore]"""
import json, sys, urllib.request
root = __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))
key = next(l.split()[0] for l in open(f"{root}/dev_api_keys.txt") if l.strip() and not l.startswith("#"))
AID = "cecee14d-20b0-402a-99af-fdb3e7a4c5e9"
API = "https://api.todofor.ai/api/v1/agents"
ORIG = "Before you finish go over each statement the user task has requested you to do."
EXTRA = ("For iterative data work (video, audio, images, large files) keep one persistent Python "
         "session (e.g. `pip install ipykernel jupyter-client` and drive a kernel, or a long-lived "
         "`python -i` under a pty) so loaded data stays in memory between steps instead of "
         "re-running scripts from scratch.")
new = ORIG if sys.argv[1:] == ["restore"] else f"{ORIG}\n\n{EXTRA}"

def get(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"x-api-key": key})))

body = json.dumps({"agentSettingsId": AID, "updates": {"systemMessage": new}}).encode()
urllib.request.urlopen(urllib.request.Request(f"{API}/{AID}/settings", data=body, method="PUT",
                       headers={"x-api-key": key, "Content-Type": "application/json"}))
stored = get(f"{API}/{AID}")["systemMessage"]
assert stored == new, "stored mismatch"
print(f"ok: stored {len(stored)} chars\n---\n{stored}")
