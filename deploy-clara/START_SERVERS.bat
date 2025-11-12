@echo off
echo ========================================
echo Starting All Servers
echo ========================================
echo.

cd /d "%~dp0"

echo Starting Unified Server...
start "Unified Server" cmd /k "cd apps\server && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Client App...
start "Client App" cmd /k "cd apps\client && npm run dev"

timeout /t 2 /nobreak >nul

echo Starting Staff App...
start "Staff App" cmd /k "cd apps\staff && npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo ALL SERVERS STARTED
echo ========================================
echo.
echo CLIENT INTERFACE:
echo   http://localhost:5173
echo.
echo STAFF INTERFACE:
echo   http://localhost:5174
echo.
echo UNIFIED SERVER API:
echo   http://localhost:8080
echo   Health: http://localhost:8080/healthz
echo.
echo Staff Login (Demo):
echo   Email: nagashreen@gmail.com
echo   Password: password
echo.
echo ========================================
echo.
pause

