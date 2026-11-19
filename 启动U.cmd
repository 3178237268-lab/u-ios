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

rem ---- every address you may need, also saved to addresses.txt ----
set "LANIP="
for /f "delims=" %%i in ('node lan-ip.js') do set "LANIP=%%i"
if "%LANIP%"=="" set "LANIP=127.0.0.1"

echo.
echo ===================== U addresses =====================
echo  App / web    : http://%LANIP%:8765
echo  Admin LAN    : http://%LANIP%:8787/admin.html
echo  Admin local  : http://127.0.0.1:8787/admin.html
echo  Admin public : https://u.serveousercontent.com/admin.html?serveo-skip-browser-warning=true
echo  Login        : admin123 / admin123
echo =======================================================
echo  public link has serveo-skip-browser-warning=true so the
echo  Serveo warning page is skipped; if it still shows, tap Continue once.
echo.

> addresses.txt echo U addresses - regenerated every time the server starts
>> addresses.txt echo.
>> addresses.txt echo App / web    : http://%LANIP%:8765
>> addresses.txt echo Admin LAN    : http://%LANIP%:8787/admin.html
>> addresses.txt echo Admin local  : http://127.0.0.1:8787/admin.html
>> addresses.txt echo Admin public : https://u.serveousercontent.com/admin.html?serveo-skip-browser-warning=true
>> addresses.txt echo Login        : admin123 / admin123
>> addresses.txt echo.
>> addresses.txt echo Serveo warning page: tap Continue once, or use the public link above.

node run-all.js
echo.
echo U stopped.
pause >nul
