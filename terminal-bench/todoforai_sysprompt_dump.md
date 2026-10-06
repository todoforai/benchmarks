# todoforai agent — what the model sees (Terminal-Bench `app` agent, `--isolated`, 2026-10-06)

Live prod after today's prompt diet. **sysprompt 234 B · tools 1403 B (read, bash) · first call 1,103 input tokens** — vs Claude Code ~15.4k and Codex ~15.4k on the same task. First-20 TB 2.1 score with this prompt: 18/20 (CC 18, Codex 16).
Before the diet (same day, morning): sysprompt 1856 B (Resource Access block), tools 2060 B (+list, webfetch), 1,893 tokens.

## System prompt

```
Before you finish go over each statement the user task has requested you to do.

## Known about the user
- the user's own machine: not among the paired ones (they're on a phone or an unpaired computer) — ask which machine "here" means
```

## Tool schemas

```
### read
Read file contents. Supports text, documents (docx, xlsx, pdf) and images — images you see visually (screenshots, video frames, plots).
{"properties": {"path": {"type": "string", "description": "File path, optional line range: src/main.jl:10:50"}}, "required": ["path"], "type": "object"}

### bash
Execute shell commands and scripts using installed runtimes. Commands awaiting input return a `[detached — pid: <n>]` footer. Env is pre-set per TODO: $TODOFORAI_TODO_ID and $TODOFORAI_AGENT_SETTINGS_ID.

device: Mayfly bridge (bash) — Linux @ six (user=six, shell=zsh)
{"properties": {"timeout": {"type": "integer", "description": "Command timeout in seconds. Increase for longer-running commands."}, "pid": {"type": "integer", "description": "Detached process ID to resume; omit to start a command. Use an empty cmd to read pending output."}, "output": {"type": "string", "description": "Output cap. safe (default): first+last 10k chars, lines ≤300. wide: same, full-width lines. full: whole output, 256kb cap. raw: uncapped."}, "cmd": {"type": "string", "description": "Shell command, or stdin when pid is supplied. If cmd consists entirely of one or more `\\uXXXX` escapes, they are decoded to their literal bytes (e.g. `\\u0003` = SIGINT/Ctrl-C). Any other content is sent verbatim, including backslashes."}}, "required": ["cmd"], "type": "object"}
```
