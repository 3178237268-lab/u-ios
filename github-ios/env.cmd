@echo off
rem 探测本机代理端口，并把 gh / git 都指向它（否则连 github.com 的某些 IP 会超时）
set "U_PROXY="
for /f "delims=" %%i in ('node "%~dp0detect-proxy.js" 2^>nul') do set "U_PROXY=%%i"
if defined U_PROXY (
  set "HTTPS_PROXY=%U_PROXY%"
  set "HTTP_PROXY=%U_PROXY%"
  set "https_proxy=%U_PROXY%"
  set "http_proxy=%U_PROXY%"
  echo [proxy] using %U_PROXY%
) else (
  echo [proxy] none found, using direct connection
)