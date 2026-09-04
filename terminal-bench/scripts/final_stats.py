"""Final per-task verdict of the tb2 sweep: last intended attempt per task.

Attempts are ordered by job (clean → rerun1 → rerun2 → visual → rerun3) then
start time; the accidental 00:59 overnight re-fires are reported separately.
"""
import json, glob, collections, sys

ORDER = ["tb2-clean-win", "tb2-rerun1", "tb2-rerun2", "tb2-visual", "tb2-rerun3"]
def is_accident(job):  # schtasks /sc once re-fired every clean/rerun1/rerun2 batch overnight 09-03
    return "__2026-09-03__" in job and not job.startswith("tb2-visual")

def load(pattern):
    rows = collections.defaultdict(list)
    for r in glob.glob(pattern):
        d = json.load(open(r)); job = r.split("/")[1]; t = r.split("/")[2].split("__")[0]
        v = d.get("verifier_result") or {}; e = d.get("exception_info") or {}
        rw = (v.get("rewards") or {}).get("reward") if v else None
        ex = e.get("exception_type", "") if e else ""
        rank = next(i for i, o in enumerate(ORDER) if job.startswith(o))
        a = d.get("agent_execution") or {}
        rows[t].append((rank, a.get("started_at", ""), job, rw, ex))
    return rows

rows = load("jobs/tb2-*/*/result.json")
intended = {t: [x for x in v if not is_accident(x[2])] for t, v in rows.items()}
fin = {t: max(v) for t, v in intended.items() if v}
p = sorted(t for t, x in fin.items() if x[3] == 1)
print(f"FINAL (last intended attempt): {len(p)}/{len(fin)} = {100*len(p)/len(fin):.1f}%")
anyp = sorted(t for t, v in rows.items() if any(x[3] == 1 for x in v))
print(f"pass in ANY attempt (incl. accidental reruns): {len(anyp)}/{len(rows)}")
print()
by = collections.defaultdict(list)
for t, x in fin.items():
    if x[3] != 1:
        by[x[4] or "wrong-answer"].append(f"{t}  [{x[2].split('__')[0]}]")
for k in sorted(by):
    print(f"{k} ({len(by[k])}):"); [print("   ", i) for i in sorted(by[k])]
print()
acc = {t: [x for x in v if is_accident(x[2])] for t, v in rows.items()}
flips = [(t, fin[t][3], a[-1][3]) for t, a in acc.items() if a and t in fin and (a[-1][3] == 1) != (fin[t][3] == 1)]
print("accidental 00:59 reruns that flipped vs final:", len(flips))
for t, f, a in sorted(flips): print(f"    {t}: final={f} accidental={a}")
if "--all" in sys.argv:
    print("\nall attempts:")
    for t in sorted(rows):
        print(t, [(x[2].split('__')[0] + ('*' if is_accident(x[2]) else ''), x[3], x[4]) for x in sorted(rows[t])])
