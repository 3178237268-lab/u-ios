@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title U - Step 2 create repo and push
cd /d "%~dp0.."
call "%~dp0env.cmd"
echo === Step 2: commit and push to GitHub ===
git add -A
git commit -m "add ios-u: Xcode project, build scripts, GitHub Actions"
gh repo create u-ios --public --source . --push
if errorlevel 1 (
  echo.
  echo Repo may already exist. Pushing to the existing one instead...
  for /f %%i in ('gh api user --jq .login') do set GHU=%%i
  git remote remove origin 2>nul
  git remote add origin https://github.com/!GHU!/u-ios.git
  git push -u origin main
)
echo.
echo Done. Now run 3-runs.cmd, or open https://github.com and click the Actions tab.
pause