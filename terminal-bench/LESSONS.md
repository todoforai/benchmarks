# Benchmark lessons — learned the expensive way (2026-08)

Each of these cost real hours or real data during the TB 2.1 gpt-5.6-sol run.
Read before the next sweep.

## 1. Verify the SERVED model, never trust the requested one
Hobby-tier accounts are silently clamped to Sonnet (`clampHobbyModel`,
`packages/shared-fbe/src/billing.ts`) — no error, and the CLI header still
echoes the model you asked for. A whole batch ran on the wrong model and only
wall-clock regression (211s -> 1266s on the same task) exposed it.
- Before a run: `scripts/check_tiers.sh` — every account must be a paid tier.
- After a run: `scripts/verify_model.sh <job>` — reads the dispatched model
  from assistant message metadata, the only honest signal. It must try every
  pool key: a todo is only readable by the account that owns it.

## 2. Backend deploys kill in-flight trials — and the damage is asymmetric
A deploy closes edge WebSockets (1012 "Server restarting" / 1013). In batch 1
all 6 in-flight trials died; in later waves the edge reconnected and 5/8
survived. You cannot tell infra zeroes from real zeroes without checking
`agent/edge.txt` for "Server restarting" — `progress.sh` does this (R flag).
- Coordinate deploy windows before starting a sweep.
- A pass through a blip still counts; a fail with a restart gets a rerun.

## 3. Pause with `touch jobs/STOP`, NEVER kill the runner
run_batches.sh checks jobs/STOP between batches: the running batch finishes,
nothing new starts, the resume command is printed (`run_batches.sh P B C
<start-batch>`). Killing the script instead SIGTERMs the process group and
takes harbor's in-flight trials with it — that alone cost 3 trials.
Also: a bash already running holds the OLD script text; edits (incl. the STOP
check itself) only apply to the next launch.

## 4. Stopping and deleting must never be one command
An early stop_run.sh took a job-prefix and rm -rf'd it — which destroyed a
finished batch's results along with the interrupted one. stop_run.sh now only
stops; deleting is a manual, eyes-on step.

## 5. Docker networks leak on every kill
Each killed compose run leaves its per-trial network; ~30 leftovers exhaust
the address pools and every subsequent trial dies at env-create with "all
predefined address pools have been fully subnetted". `docker network prune -f`
runs between batches and in stop_run.sh.

## 6. WSL idles out under long runs
The distro shuts down after ~5 min without an active wsl.exe process, killing
everything. `.wslconfig vmIdleTimeout=-1` does NOT cover the distro. Fix:
launch via Scheduled Tasks (schtasks) so the process tree is independent, plus
a keepalive task.

## 7. Retry infra errors, never agent outcomes
Harbor default is max_retries=0, so a provider stall (backend gives a stall 2
attempts, then the todo ERRORs -> ApiError) counted as a zero. run_batches.sh
now passes `--max-retries 2 --retry-include ApiError --retry-include
NetworkConnectionError`. AgentTimeoutError stays excluded: retrying real
outcomes inflates the score.

## 8. Rerun bookkeeping
`failed_tasks.sh` collects rerun candidates (restart-hit fails + rewardless
trials with a result.json). Trials whose dirs were deleted are invisible to
any heuristic — they live in scripts/lost_tasks.txt. Final score = sweep
result overridden by rerun where one exists; reruns of that run confirmed
10/14 infra victims as passes while both double-fails failed twice.

## 9. Small traps that ate time anyway
- Windows checkout: CRLF breaks every shell script — `sed -i 's/\r$//'` after
  edit, .gitattributes for keeps.
- `sed -i` on the runner script creates a new inode; see lesson 3.
- Dev key file format is `<key> <email>`; auth header is `x-api-key`.
- TB 2.0 has 28 known-broken tasks; 2.1 fixes them (same 89 names except
  install-windows-3-11 -> 3.11). Don't measure on 2.0.

## 10. Sweep 2026-09-02 (review off, sysmsg diet) — traps
- `run_batches.sh` prunes ALL docker containers before each batch: never start a
  second run_batches while one is running — it kills the other run's trials
  (exit 137, no reward). Chain reruns with `until grep -q 'ALL DONE' <log>`.
- `schtasks /create /sc once /st 23:59` + `/run`: the task ALSO fires at 23:59.
  Delete it right after `/run`, or the whole sweep repeats overnight (~$47).
- The keepalive task (`wsl -d Ubuntu -- true` every 3 min) pops a WSL console
  window each time; delete it when no sweep is running.
- nginx per-IP limit: 10 r/s 429s at 5 concurrent `--isolated` mints; 50 r/s is
  clean at 12 concurrent.
- First-chunk stream timeout: sol xhigh legitimately thinks >2 min; 120 s
  killed 3 tasks that had already done the work. Now 600 s.
- `read` is loaded and shows PNGs to the model (verified by hand in a mayfly
  session), but no bench trial ever called it: the model defaults to bash +
  ffmpeg/tesseract. A tool description alone doesn't change that.
- Review sub-agent: −2 tasks without it, −65 % cost. The lost tasks are the
  "almost" ones (1/2 moves, 3/4 tests) — exactly what a review pass catches.
