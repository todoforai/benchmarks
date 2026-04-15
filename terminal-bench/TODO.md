# Terminal-Bench TODO

## Verify CLI flags work in headless/container context

- [ ] `--dangerously-skip-permissions` — does it actually suppress all approval prompts? Never confirmed in practice. Test with a task that triggers file write / shell exec blocks.
- [ ] `--non-interactive` — confirm it exits cleanly (exit code 0) when the todo completes, not just on timeout.
- [ ] `--agent Agent` — is `Agent` the right agent name? Check available agents, maybe needs a specific name.
- [ ] `--path /app` — confirm the edge also sees `/app` as workspace and executes blocks there (not in `~` or cwd).
- [ ] `echo instruction | todoai` vs `todoai "instruction"` — which is more reliable for multi-line task descriptions?

## Edge startup

- [ ] `sleep 2` after starting edge — is 2s enough to connect to the server? Should poll for readiness instead.
- [ ] Edge reconnect — if the edge disconnects mid-task, does `todoai` hang or fail gracefully?
- [ ] Check edge logs (`/logs/agent/edge.txt`) are actually written and useful for debugging.

## Key pool / concurrency

- [ ] Test with `--n-concurrent > 1` — each container gets its own key from the pool.
- [ ] What happens if a key is rate-limited mid-task?

## Run a smoke test

```bash
export TODOFORAI_API_KEYS="key1"
export TODOFORAI_API_URL="http://172.17.0.1:4000"

harbor run -d "terminal-bench/terminal-bench-2" \
  --agent-import-path "todoforai_tbench:TODOforAIHarborAgent" \
  --task-id hello-world
```

- [ ] Does it pass `hello-world`?
- [ ] Try a medium task (e.g. `openssl-selfsigned-cert`)
- [ ] Try a hard task (e.g. `build-linux-kernel-qemu`)

## Dist / install

- [ ] `./scripts/rebuild_wheels.sh` — test that rebuilt dist installs correctly in a fresh container.
- [ ] Confirm `install-todoforai.sh.j2` template installs both `todoai` and `todoforai-edge` from dist when wheels are present, falls back to npm otherwise.
