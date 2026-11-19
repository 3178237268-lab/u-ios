@echo off
chcp 65001 >nul
title U - Step 1 login to GitHub
cd /d "%~dp0.."
call "%~dp0env.cmd"
echo === Step 1: login GitHub CLI ===
echo.
echo A one-time code will be printed. Press Enter, paste the code in the browser.
echo If it still times out, the proxy port is not the one your VPN uses.
echo.
gh auth login --hostname github.com --git-protocol https --web
echo.
echo --- status ---
gh auth status
echo.
pause