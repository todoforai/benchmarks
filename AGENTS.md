# AGENTS.md — benchmarks/

Benchmarking runs on the **Windows machine** (WSL/Ubuntu), not in the cloud.
Docker images from runs fill `/` (92G) — check `docker system df`, `docker image prune -a`
when it grows.

- `terminal-bench/` — main effort: Harbor adapter (`todoforai_tbench`) on
  `terminal-bench/terminal-bench-2` (use **2.1**; 2.0 has 28 broken tasks).
- `adapter/` + `online-mind2web/` — web-agent bench. `common/`, `results/` — shared.

## Before any sweep
Read `terminal-bench/LESSONS.md` — every rule there cost real hours. The big ones:
- Verify the **served** model (`scripts/check_tiers.sh`, `scripts/verify_model.sh <job>`);
  hobby tier silently clamps to Sonnet.
- Pause with `touch terminal-bench/jobs/STOP` — **never kill the runner**; the batch
  finishes and prints the resume command. A running bash holds the OLD script text.
- Stopping ≠ deleting: `stop_run.sh` only stops. Never `rm -rf` a job prefix.
- Coordinate backend deploys: a deploy closes edge sockets and zeroes in-flight trials;
  `progress.sh` flags them (R). Infra zeroes get reruns, real zeroes don't.
- Retry infra only (`ApiError`, `NetworkConnectionError`), never `AgentTimeoutError`.
- `docker network prune -f` between batches; leaked networks kill later trials.
- Job dirs must be self-describing: `--job-name <model>__<timestamp>`.
- CRLF from Windows checkouts breaks every script (`sed -i 's/\r$//'`; see
  `.gitattributes`). `sed -i` on a running script creates a new inode.

## Running
```bash
cd terminal-bench
./run_single.sh <task-id>                   # one task, validates creds first
scripts/run_batches.sh P B C [start-batch]  # sweep; resume with the printed cmd
scripts/progress.sh                         # infra damage vs real fails
scripts/failed_tasks.sh                     # rerun candidates
```
Keys: `TODOFORAI_API_KEYS_FILE` (default `dev_api_keys.txt`, `<key> <email>`, header
`x-api-key`), one per concurrent container. Never commit keys or run artifacts
(`runs/`, `logs/`, `*.json` are gitignored).

## Reporting
Final score = sweep result overridden by rerun where one exists. Cost from the billing
ledger (`scripts/run_tokens.mjs`) at published rates, last attempt per task only.
Write to `RESULTS_<run>.md`, append durable gotchas to `LESSONS.md`.
