@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
call npm run standalone:setup --prefix apps/desktop
if errorlevel 1 (
  echo Setup failed. Copy the error above for diagnosis.
  pause
  exit /b 1
)
echo Setup complete. Run Start-Standalone.cmd.
pause
