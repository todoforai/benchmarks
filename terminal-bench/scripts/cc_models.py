"""Which models answered in a Claude Code trial, and how many refusals. Usage: cc_models.py <trial-dir>..."""
import json, sys, glob

for d in sys.argv[1:]:
    models, refusals, first_user = {}, 0, None
    for f in glob.glob(d + "/agent/sessions/projects/-app/*.jsonl"):
        for line in open(f):
            try:
                x = json.loads(line)
            except ValueError:
                continue
            m = x.get("message") or {}
            if x.get("type") == "assistant":
                mo = m.get("model")
                models[mo] = models.get(mo, 0) + 1
                refusals += m.get("stop_reason") == "refusal"
            elif x.get("type") == "user" and first_user is None and isinstance(m.get("content"), str):
                first_user = m["content"][:400].replace("\n", " ")
    print("==", d.rstrip("/").split("/")[-1])
    print("  task:", first_user)
    print("  models:", models, "refusals:", refusals)
