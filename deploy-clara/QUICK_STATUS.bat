@echo off
cls
echo ========================================
echo   CLARA SYSTEM STATUS
echo ========================================
echo.

echo Checking ports...
echo.

set SERVER_RUNNING=0
set CLIENT_RUNNING=0
set STAFF_RUNNING=0

netstat -ano | findstr ":8080.*LISTENING" >nul
if %errorlevel%==0 (
    echo [OK] UNIFIED SERVER - Running on port 8080
    set SERVER_RUNNING=1
    echo.
    echo   ACCESS LINKS:
    echo     CLIENT: http://localhost:8080
    echo     STAFF:  http://localhost:8080/staff
    echo.
) else (
    echo [X] UNIFIED SERVER - Not running on port 8080
    echo     This is REQUIRED for both Client and Staff!
    echo.
)

netstat -ano | findstr ":5173.*LISTENING" >nul
if %errorlevel%==0 (
    echo [OK] CLIENT DEV - Running on port 5173 (proxied via 8080)
    set CLIENT_RUNNING=1
) else (
    echo [X] CLIENT DEV - Not running (needed for dev mode)
)
echo.

netstat -ano | findstr ":5174.*LISTENING" >nul
if %errorlevel%==0 (
    echo [OK] STAFF DEV - Running on port 5174 (proxied via 8080)
    set STAFF_RUNNING=1
) else (
    echo [X] STAFF DEV - Not running (needed for dev mode)
)
echo.

echo ========================================
echo   ACCESS LINKS
echo ========================================
echo.
echo   CLIENT: http://localhost:8080
echo   STAFF:  http://localhost:8080/staff
echo.
echo   Staff Login: nagashreen@gmail.com / password
echo.
echo ========================================
echo.

if %SERVER_RUNNING%==0 (
    echo.
    echo ========================================
    echo   SERVERS NOT RUNNING
    echo ========================================
    echo.
    echo To start all servers, run:
    echo   START_ALL.bat
    echo.
    echo Or run this command in the project root:
    echo   npm run dev
    echo.
    echo Would you like to start the servers now? (Y/N)
    set /p START_CHOICE=
    if /i "%START_CHOICE%"=="Y" (
        echo.
        echo Starting servers...
        call START_ALL.bat
        echo.
        echo Servers are starting. Wait 10-15 seconds, then run this script again to check status.
    )
    echo.
)

pause
