@echo off
title CCTV WATCHDOG - LOCAL HARDWARE PING BRIDGE
color 0A
echo =========================================================================
echo  🔒 CCTV WATCHDOG - LOCAL HARDWARE PING BRIDGE (500+ CAMERAS)
echo =========================================================================
echo.
echo  📍 Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
  color 0C
  echo ❌ ERROR: Node.js is not installed on this computer!
  echo Please download and install Node.js from https://nodejs.org/
  echo.
  pause
  exit
)

echo  🟢 Node.js detected! Starting Local Ping Bridge on port 3555...
echo.
echo  ⚡ Keep this window OPEN while running CCTV IP Trigger Ping in the app.
echo  📡 Bridge will automatically execute Windows CMD ICMP pings for all cameras.
echo -------------------------------------------------------------------------
node local-ping-bridge.js
pause
