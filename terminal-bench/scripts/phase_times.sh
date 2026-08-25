#!/bin/bash
# Per-trial timeline: total wall clock vs. how much of it the agent actually
# had, so we can tell "model was slow" from "our setup ate the budget".
# Usage: bash phase_times.sh <job-glob>
set -u
cd "$(dirname "$0")/../jobs" || exit 1

python3 - "$@" <<'PY'
import json, glob, sys
from datetime import datetime

def ts(s):
    if not s: return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))

pat = sys.argv[1] if len(sys.argv) > 1 else "*"
rows = []
for f in sorted(glob.glob(f"{pat}/*/result.json")):
    r = json.load(open(f))
    start, end = ts(r.get("started_at")), ts(r.get("finished_at"))
    total = (end - start).total_seconds() if start and end else None
    ar = r.get("agent_result") or {}
    vr = r.get("verifier_result") or {}
    exc = (r.get("exception_info") or {})
    rows.append((
        r["trial_name"][:40],
        vr.get("reward"),
        round(total) if total else "",
        round(ar.get("duration_sec") or 0) or "",
        round(vr.get("duration_sec") or 0) or "",
        (exc.get("exception_type") or "").replace("harbor.trial.errors.", "")[:22],
    ))

print(f"{'trial':<41}{'rew':<5}{'total':>7}{'agent':>7}{'verif':>7}  failure")
for n, rew, tot, ag, ve, ex in rows:
    print(f"{n:<41}{str(rew):<5}{tot:>7}{ag:>7}{ve:>7}  {ex}")
PY
