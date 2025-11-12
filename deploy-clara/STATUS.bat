@echo off
cls
echo ========================================
echo   CLARA UNIFIED SYSTEM STATUS
echo ========================================
echo.

netstat -ano | findstr ":8080.*LISTENING" >nul
if %errorlevel%==0 (
    echo [OK] All services accessible via:
    echo.
    echo   CLIENT: http://localhost:8080
    echo   STAFF:  http://localhost:8080/staff
    echo.
) else (
    echo [X] Server not running on port 8080
    echo     Run START_ALL.bat to start servers
    echo.
)

echo ========================================
pause

