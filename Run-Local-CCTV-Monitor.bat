@echo off
title SGS IT HELP-DESK & CCTV MONITOR LAUNCHER
color 0B
echo =========================================================================
echo  🔒 SGS IT HELP-DESK - LOCAL SECURITY AUDIT & CCTV NETWORK LAUNCHER
echo =========================================================================
echo.
echo  📍 Checking components...
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
  color 0C
  echo ❌ ERROR: Node.js is not installed on this computer!
  echo Please download and install Node.js from https://nodejs.org/
  echo.
  pause
  exit
)

:: Automatically check if node_modules exists, run npm install if missing
if not exist "node_modules\" (
  echo 📦 [FIRST RUN DETECTED] Installing project dependencies...
  echo This might take a minute, please wait...
  call npm install
  echo.
)

:: Launch browser after a short delay to allow the server to start
echo 🚀 Opening CCTV Dashboard at http://localhost:3000...
start http://localhost:3000

echo.
echo 🟢 Server starting! Keep this command terminal window OPEN...
echo -------------------------------------------------------------
call npm run dev

pause
