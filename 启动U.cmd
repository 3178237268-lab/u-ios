@echo off
chcp 936 >nul
title U server (close this window to stop)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node.js 22.5+ from https://nodejs.org
  pause
  exit /b 1
)
netsh advfirewall firewall show rule name="U Server 8787" >nul 2>nul
if errorlevel 1 netsh advfirewall firewall add rule name="U Server 8787" dir=in action=allow protocol=TCP localport=8787 >nul 2>nul
netsh advfirewall firewall show rule name="U App 8765" >nul 2>nul
if errorlevel 1 netsh advfirewall firewall add rule name="U App 8765" dir=in action=allow protocol=TCP localport=8765 >nul 2>nul
node run-all.js
echo.
echo U stopped.
pause >nul
