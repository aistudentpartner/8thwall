@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
call npm run standalone:start --prefix apps/desktop
if errorlevel 1 pause
