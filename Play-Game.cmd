@echo off
cd /d "%~dp0game"
node tools\serve-local.cjs %*
exit /b %errorlevel%
