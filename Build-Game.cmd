@echo off
cd /d "%~dp0game"
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-web.ps1 %*
exit /b %errorlevel%
