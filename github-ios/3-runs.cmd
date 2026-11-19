@echo off
chcp 65001 >nul
title U - Step 3 build status
cd /d "%~dp0.."
call "%~dp0env.cmd"
echo === Step 3: trigger and watch the iOS build ===
gh workflow run ios.yml
timeout /t 6 >nul
gh run list --workflow ios.yml --limit 5
echo.
echo Watching the newest run (Ctrl+C to stop watching):
gh run watch
echo.
echo Artifact download: gh run download -n U-unsigned-ipa
pause