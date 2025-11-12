@echo off
REM Batch script to start development servers
REM This ensures port 8080 is free before starting

echo.
echo 🚀 Starting Clara Development Servers...
echo.

REM Check if port 8080 is in use
netstat -ano | findstr ":8080" >nul
if %errorlevel% == 0 (
    echo ⚠️  Port 8080 is already in use
    echo    Attempting to free the port...
    echo.
    
    REM Get the PID using port 8080
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
        echo    Stopping process with PID: %%a
        taskkill /PID %%a /F >nul 2>&1
        timeout /t 2 /nobreak >nul
        echo    ✅ Port 8080 is now free
    )
)

echo.
echo 📦 Starting all services (Server, Client, Staff)...
echo    Server will start on: http://localhost:8080
echo    Client will start on: http://localhost:5173
echo    Staff will start on: http://localhost:5174
echo.

REM Start all services
call npm run dev

