@echo off
title Clara Unified System - Starting All Servers
color 0A

echo ========================================
echo   CLARA UNIFIED SYSTEM
echo   Starting All Servers...
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Starting Unified Server (Port 8080)...
start "Unified Server" cmd /k "cd apps\server && echo === UNIFIED SERVER (Port 8080) === && npm run dev"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Client Dev Server (Port 5173 - proxied via 8080)...
start "Client Dev" cmd /k "cd apps\client && echo === CLIENT DEV (Port 5173) === && npm run dev"
timeout /t 2 /nobreak >nul

echo [3/3] Starting Staff Dev Server (Port 5174 - proxied via 8080)...
start "Staff Dev" cmd /k "cd apps\staff && echo === STAFF DEV (Port 5174) === && npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   ALL SERVERS STARTED
echo ========================================
echo.
echo ACCESS LINKS (Unified Server):
echo.
echo   CLIENT: http://localhost:8080
echo   STAFF:  http://localhost:8080/staff
echo.
echo Staff Login: nagashreen@gmail.com / password
echo.
echo ========================================
echo.
echo Servers are starting in separate windows.
echo Wait 10-15 seconds for servers to initialize.
echo.
pause
