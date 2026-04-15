@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

echo Starting Faceburger printer listener...
call npm start
echo.
echo Process exited. Press any key to close.
pause > nul
