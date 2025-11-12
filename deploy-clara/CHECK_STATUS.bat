@echo off
cls
echo ========================================
echo   CLARA SYSTEM STATUS
echo ========================================
echo.

echo Checking ports...
echo.

netstat -ano | findstr ":5173.*LISTENING" >nul
if %errorlevel%==0 (
    echo [OK] CLIENT - Running on port 5173
    echo      http://localhost:5173
) else (
    echo [X] CLIENT - Not running
)
echo.

netstat -ano | findstr ":5174.*LISTENING" >nul
if %errorlevel%==0 (
    echo [OK] STAFF - Running on port 5174
    echo      http://localhost:5174
) else (
    echo [X] STAFF - Not running
)
echo.

netstat -ano | findstr ":8080.*LISTENING" >nul
if %errorlevel%==0 (
    echo [OK] SERVER - Running on port 8080
    echo      http://localhost:8080
) else (
    echo [X] SERVER - Not running
    echo      This is REQUIRED for Staff login!
)
echo.

echo ========================================
echo   ACCESS LINKS
echo ========================================
echo.
echo   CLIENT: http://localhost:5173
echo   STAFF:  http://localhost:5174
echo   SERVER: http://localhost:8080
echo.
echo   Staff Login: nagashreen@gmail.com / password
echo.
pause

