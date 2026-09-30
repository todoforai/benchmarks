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
  from assistant message metadata, the only honest signal. A todo is only
  readable by the account that owns it (pre-0cda60a sweeps used 6 accounts).

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
Agent-driven variant (09-30): `systemd-run --user` alone dies ~20 s after the
launching `wsl.exe` returns (user manager hits exit.target). Keep a
`wsl.exe -d Ubuntu -- sleep infinity` alive as a *detached agent-shell process*;
PowerShell `Start-Process -WindowStyle Hidden wsl.exe ...` did not survive, and
the keepalive dies with the pc_2 bridge (BRIDGE_OFFLINE -> job killed).

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

## 9. Our scoring rule is ours, not the leaderboard's
"Sweep overridden by rerun" is fine internally — the infra zeroes are OUR damage
(deploying mid-sweep) and vanish once a run is deploy-frozen. But tbench.ai
scores `successes / ALL trials` over ≥5 trials/task: reruns average in, not
substitute. Expect a submitted run below our headline. Details in
RESULTS_tb2-clean-win ("Comparability with tbench.ai"). Real submission: freeze
backend+edge deploys, budget ~445 trials (~8-10 h, ~$235 promo / ~$450 list).

## 10. Small traps that ate time anyway
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

## Opus 5.5 (09-25)
- Anthropic's safety classifier hard-refuses 4 TB 2.1 tasks on Opus 5.5 —
  `dna-insert`, `dna-assembly` ("bio"), `filter-js-from-html`,
  `break-filter-js-from-html` ("cyber"). The todo ends after 1-2 calls with an
  error block "refused to answer this request (flagged as: …)"; harbor logs
  `ApiError`, the infra retry refuses again. A "you are being evaluated on
  Terminal-Bench 2.1" sysmsg didn't move it (3/4 refused again; the one pass is
  within flip-flop noise). Don't retry; exclude them from the score (09-30 decision: report X/81, raw /89
  only as a footnote, and compare other models on the same 81).
- The 0926 full sweep added 4 more (1 attempt each): `protein-assembly` ("bio"),
  `crack-7z-hash`, `password-recovery`, `vulnerable-secret` ("cyber") → 8 refused
  tasks in total. `ApiError` in `result.json` looks like infra; check the todo's
  messages for "flagged as" before queuing an infra retry.

## Verifier / container traps (09-30)
- **Read `verifier/test-stdout.txt` before calling a 0 a model fail.** qemu-startup
  and qemu-alpine-ssh (debian:bullseye-slim) failed on every Opus 5.5 run because
  test.sh's `apt-get install curl ...` 404s on the EOL bullseye-security pool
  (index still lists debs the pool dropped) → no curl/uvx → reward 0; the agent had
  solved both. Harness now comments out bullseye-security after the agent run
  (fa3234d). All other tasks are ubuntu:24.04 / bookworm / trixie.
- **`nproc` lies in harbor containers.** task.toml `cpus` (1 for 83/89 tasks) is
  only a docker CPU quota; `nproc` still says 64. extract-moves 0928 ran
  `xargs -P $(nproc)` = 64 tesseracts on 1 CPU. Harness now runs the CLI under
  `taskset` on a random N-core window + `OMP_NUM_THREADS=N` (695e674, logged in
  `/logs/agent/cpus.txt`); getconf / os.cpu_count() still say 64. The rerun didn't
  thrash but still timed out: 951 OCR frames don't fit 1 CPU × 1800 s.

## Concurrency (09-25, `scripts/bench_concurrency.sh`, 20 fast Sol tasks)
| -n | wall | pass | peak RAM | peak load |
|---|---|---|---|---|
| 5 | 1286 s (one 984 s timeout outlier) | 19/20 | 2 GB | 1.9 |
| 10 | 291 s | 19/20 | 3 GB | 2.4 |
| 20 | 227 s | 19/20 | 3 GB | 4.4 |
No 429s, no infra errors, per-trial agent time flat (~77 s) from 10 to 20: the
backend and one account don't limit at 20. Wall time is set by the slowest
task, so one harbor call over all tasks beats batches. Host (64 threads,
62 GB) is idle at 20. Launch detached as a `systemd-run --user` unit
(linger on) while a `wsl.exe -- sleep infinity` holds the VM — Avast blocked
the schtasks keepalive after a reboot, and the distro stops with the last
wsl.exe.

## Wall-time anatomy (09-29, `RESULTS_long_runs_0929.md`)
- Measure from the backend, not the harness: `GET /api/v1/todos/<id>/messages` (page with
  `?before=<oldestMsgId>` while `hasMore`) — `runMeta(_ai).elapsed` = LLM call ending at
  `runMeta.timestamp`; tool end = result attachment `createdAt`; output text via
  `/api/v1/resources/?uri=todoforai:todos/<id>/<att>`. Bench todos: project list
  `/api/v1/projects/<pid>/todos?limit=500&cursor=…`.
- The backend clamps every bash `timeout` to **600 s** (`AgentHandler.ts` bridge_exec) and the
  model is not told; 60 calls in the 0926 sweep asked for 900-3600 s. Before fc53f37f such
  runs ended as `TIMEOUT: bridge sent no result` at 605 s with the output lost (8 ks / 16 % of
  long-trial time). After it: `[detached]` at ~600 s.
- A command waiting on a tty prompt (`awaitingInput=true`) still sits until its full
  `timeout`; tzdata cost ~300 s per polyglot trial (413-498 s → 71 s with DEBIAN_FRONTEND).
- Backend/bridge overhead between turns is ~1.4 s median (2 %) — never the bottleneck.
- `high` and `xhigh` have the same per-turn cost on Opus 5.5 (~32 s, ~3 k tokens); long
  trials are either LLM-bound (few 100-580 s thinking turns) or tool-bound, not both.
