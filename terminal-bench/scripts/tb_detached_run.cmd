@echo off
rem Detached Terminal-Bench run via Windows Task Scheduler (LESSONS.md §6: anything
rem started from a wsl.exe session dies with that session).
rem   tb_detached_run.cmd <agent> <model> <effort|-> <tasks-file> [log-name] [k]
rem Register+start:
rem   powershell -c "Register-ScheduledTask -TaskName TB_run -Force -Action (New-ScheduledTaskAction -Execute 'C:\repo\todoforai\benchmarks\terminal-bench\scripts\tb_detached_run.cmd' -Argument 'todoforai anthropic:anthropic/claude-opus-5.5 - tasks_first20.txt ours-first20') -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 12) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries); Start-ScheduledTask TB_run"
set AGENT=%1
set MODEL=%2
set EFFORT=%3
set TASKS=%4
set LOG=%5
set K=%6
if "%K%"=="" set K=1
if "%LOG%"=="" set LOG=%AGENT%-run
set EFF=
if not "%EFFORT%"=="-" set EFF=-e %EFFORT%
wsl.exe -e bash -lc "cd ~/cliproxyapi && (curl -s -m2 localhost:8317/v1/models >/dev/null || (setsid nohup ./cli-proxy-api --config /home/six/cliproxyapi/config.yaml > run.log 2>&1 < /dev/null &)); sleep 3; docker ps -aq --filter status=exited | xargs -r docker rm >/dev/null; docker network prune -f >/dev/null; cd /mnt/c/repo/todoforai/benchmarks/terminal-bench && source ~/tbench-venv/bin/activate && ./run.sh -a %AGENT% -m %MODEL% %EFF% -t %TASKS% -n 4 -k %K% > %LOG%.log 2>&1"
