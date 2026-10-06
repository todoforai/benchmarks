@echo off
rem Block until the given scheduled task is no longer Running (chain runs, keep concurrency at 4).
rem   tb_wait_task.cmd <TaskName>
:wait
powershell.exe -NoProfile -Command "if ((Get-ScheduledTask %1).State -eq 'Running') { exit 1 } else { exit 0 }"
if errorlevel 1 (timeout /t 60 /nobreak >nul & goto wait)
