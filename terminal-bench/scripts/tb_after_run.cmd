@echo off
rem Queue a run behind TB_run: wait until the TB_run scheduled task stops, then run
rem tb_detached_run.cmd with the same args (keeps total concurrency at 4).
:wait
powershell.exe -NoProfile -Command "if ((Get-ScheduledTask TB_run).State -eq 'Running') { exit 1 } else { exit 0 }"
if errorlevel 1 (timeout /t 60 /nobreak >nul & goto wait)
call "%~dp0tb_detached_run.cmd" %*
