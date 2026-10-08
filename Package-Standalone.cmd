@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
call npm run standalone:package --prefix apps/desktop
if errorlevel 1 (
  echo Packaging failed. Copy the error above for diagnosis.
  pause
  exit /b 1
)
echo Installer: apps\desktop\out\standalone
pause
