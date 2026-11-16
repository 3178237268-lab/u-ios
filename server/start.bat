@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [错误] 没有检测到 Node.js
  echo 请先安装 Node.js 22.5 或更高版本: https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo 正在启动 U 后台服务器...
rem 自动放行 8787 端口（需要管理员权限；失败时脚本继续运行）
netsh advfirewall firewall show rule name="U Server 8787" >nul 2>nul
if errorlevel 1 (
  netsh advfirewall firewall add rule name="U Server 8787" dir=in action=allow protocol=TCP localport=8787 >nul 2>nul
)
node src/server.js
echo.
echo 服务器已停止，按任意键关闭窗口
pause
