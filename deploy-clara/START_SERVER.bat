@echo off
title Clara Unified Server - Port 8080
color 0A
echo ========================================
echo   CLARA UNIFIED SERVER
echo   Starting on Port 8080...
echo ========================================
echo.

cd /d "%~dp0apps\server"

if not exist .env (
    echo Copying .env file...
    copy ..\..\.env .env >nul
)

echo Starting server...
echo.
npm run dev

if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo   ERROR: Server failed to start
    echo ========================================
    echo.
    echo Common fixes:
    echo   1. Check if port 8080 is already in use
    echo   2. Run: npm install
    echo   3. Check for TypeScript errors
    echo.
    pause
)

