@echo off
chcp 936 >nul
title U stop
for %%P in (8787 8765 8788) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:"LISTENING" ^| findstr /C:":%%P "') do (
    taskkill /f /pid %%a >nul 2>nul
  )
)
echo U stopped.
timeout /t 2 >nul
exit /b 0
