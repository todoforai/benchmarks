"""Set the bench `app` agent's OWN sysmsg to the variant-A text (or restore it).
The effective run prompt = user's global sysmsg + agent sysmsg (AgentSettingsService
prepareForRun); GET /agents?name= shows that merged value, GET /agents/<id> the stored one.
Usage: python3 scripts/sysmsg_variant_a.py [restore]"""
import json, sys, urllib.request
root = "/mnt/c/repo/todoforai/benchmarks/terminal-bench"
key = next(l.split()[0] for l in open(f"{root}/dev_api_keys.txt") if l.strip() and not l.startswith("#"))
AID = "cecee14d-20b0-402a-99af-fdb3e7a4c5e9"
API = "https://api.todofor.ai/api/v1/agents"
ORIG = "Before you finish go over each statement the user task has requested you to do."
EXTRA = ("Benchmark tasks are graded by hidden tests that check every requirement in the task text "
         "and its neighbouring edge cases, not just the example shown. Before declaring done: list each "
         "requirement and edge case the task text implies, test each one, and re-check numeric results "
         "and constraints against the task text.")
new = ORIG if sys.argv[1:] == ["restore"] else f"{ORIG}\n\n{EXTRA}"

def get(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"x-api-key": key})))

body = json.dumps({"agentSettingsId": AID, "updates": {"systemMessage": new}}).encode()
urllib.request.urlopen(urllib.request.Request(f"{API}/{AID}/settings", data=body, method="PUT",
                       headers={"x-api-key": key, "Content-Type": "application/json"}))
stored = get(f"{API}/{AID}")["systemMessage"]
merged = get(f"{API}?name=app")[0]["systemMessage"]
assert stored == new, "stored mismatch"
assert merged.endswith(new) and merged.count("Be flat") == 1, "merged prompt unexpected"
print(f"ok: stored {len(stored)} chars, effective {len(merged)} chars\n---\n{merged}")
