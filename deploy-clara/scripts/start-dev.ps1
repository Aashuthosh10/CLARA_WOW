# PowerShell script to start development servers
# This ensures port 8080 is free before starting

Write-Host "🚀 Starting Clara Development Servers..." -ForegroundColor Cyan
Write-Host ""

# Check if port 8080 is in use
$port8080 = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($port8080) {
    Write-Host "⚠️  Port 8080 is already in use (PID: $($port8080.OwningProcess))" -ForegroundColor Yellow
    Write-Host "   Attempting to free the port..." -ForegroundColor Yellow
    
    $process = Get-Process -Id $port8080.OwningProcess -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "   Stopping process: $($process.ProcessName) (PID: $($port8080.OwningProcess))" -ForegroundColor Yellow
        Stop-Process -Id $port8080.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "   ✅ Port 8080 is now free" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "📦 Starting all services (Server, Client, Staff)..." -ForegroundColor Cyan
Write-Host "   Server will start on: http://localhost:8080" -ForegroundColor Gray
Write-Host "   Client will start on: http://localhost:5173" -ForegroundColor Gray
Write-Host "   Staff will start on: http://localhost:5174" -ForegroundColor Gray
Write-Host ""

# Start all services
npm run dev

