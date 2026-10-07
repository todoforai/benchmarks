@echo off
rem Sequential night chain (one run at a time keeps <=4 parallel trials).
set D=C:\repo\todoforai\benchmarks\terminal-bench\scripts
call %D%\tb_detached_run.cmd codex openai/claude-opus-4-8 high tasks_codex_refusals4.txt codex48-refusals4 1
call %D%\tb_detached_run.cmd todoforai anthropic:anthropic/claude-opus-5.5 - tasks_video.txt ours-video-A 1
