# Clara Unified System Status Dashboard
Clear-Host

function Test-Port {
    param([int]$Port)
    $result = netstat -ano | Select-String ":$Port.*LISTENING"
    return $null -ne $result
}

function Test-Url {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CLARA UNIFIED SYSTEM DASHBOARD" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Checking Server Status..." -ForegroundColor Yellow
Write-Host ""

# Check Client (Port 5173)
$clientRunning = Test-Port -Port 5173
if ($clientRunning) {
    Write-Host "[✓] CLIENT INTERFACE" -ForegroundColor Green -NoNewline
    Write-Host " - Running on port 5173" -ForegroundColor Gray
    Write-Host "   → http://localhost:5173" -ForegroundColor Cyan
} else {
    Write-Host "[✗] CLIENT INTERFACE" -ForegroundColor Red -NoNewline
    Write-Host " - Not running" -ForegroundColor Gray
    Write-Host "   → Start: cd apps\client; npm run dev" -ForegroundColor Yellow
}

Write-Host ""

# Check Staff (Port 5174)
$staffRunning = Test-Port -Port 5174
if ($staffRunning) {
    Write-Host "[✓] STAFF INTERFACE" -ForegroundColor Green -NoNewline
    Write-Host " - Running on port 5174" -ForegroundColor Gray
    Write-Host "   → http://localhost:5174" -ForegroundColor Cyan
} else {
    Write-Host "[✗] STAFF INTERFACE" -ForegroundColor Red -NoNewline
    Write-Host " - Not running" -ForegroundColor Gray
    Write-Host "   → Start: cd apps\staff && npm run dev" -ForegroundColor Yellow
}

Write-Host ""

# Check Unified Server (Port 8080)
$serverRunning = Test-Port -Port 8080
$serverHealthy = $false
if ($serverRunning) {
    $serverHealthy = Test-Url -Url "http://localhost:8080/healthz"
    if ($serverHealthy) {
        Write-Host "[✓] UNIFIED SERVER" -ForegroundColor Green -NoNewline
        Write-Host " - Running and healthy on port 8080" -ForegroundColor Gray
        Write-Host "   → http://localhost:8080" -ForegroundColor Cyan
        Write-Host "   → Health: http://localhost:8080/healthz" -ForegroundColor Gray
    } else {
        Write-Host "[!] UNIFIED SERVER" -ForegroundColor Yellow -NoNewline
        Write-Host " - Running but not responding" -ForegroundColor Gray
        Write-Host "   → Check server logs for errors" -ForegroundColor Yellow
    }
} else {
    Write-Host "[✗] UNIFIED SERVER" -ForegroundColor Red -NoNewline
    Write-Host " - Not running on port 8080" -ForegroundColor Gray
    Write-Host "   → Start: cd apps\server; npm run dev" -ForegroundColor Yellow
    Write-Host "   → This is REQUIRED for Staff login!" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  QUICK ACCESS LINKS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "CLIENT INTERFACE:" -ForegroundColor White
Write-Host "  http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "STAFF INTERFACE:" -ForegroundColor White
Write-Host "  http://localhost:5174" -ForegroundColor Yellow
Write-Host "  Login: nagashreen@gmail.com / password" -ForegroundColor Gray
Write-Host ""
Write-Host "UNIFIED SERVER API:" -ForegroundColor White
Write-Host "  http://localhost:8080" -ForegroundColor Yellow
Write-Host "  Health: http://localhost:8080/healthz" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SYSTEM STATUS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($clientRunning -and $staffRunning -and $serverRunning -and $serverHealthy) {
    Write-Host "[✓] ALL SYSTEMS OPERATIONAL" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ready for:" -ForegroundColor Green
    Write-Host "  • Client video calls" -ForegroundColor Gray
    Write-Host "  • Staff login and dashboard" -ForegroundColor Gray
    Write-Host "  • Real-time call signaling" -ForegroundColor Gray
} else {
    Write-Host "[!] SOME SYSTEMS NOT RUNNING" -ForegroundColor Yellow
    Write-Host ""
    if (-not $serverRunning) {
        Write-Host "CRITICAL: Unified Server must be running for Staff login!" -ForegroundColor Red
        Write-Host "  Run: cd apps\server; npm run dev" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Press any key to refresh status (or Ctrl+C to exit)..." -ForegroundColor Gray
Write-Host ""

$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Refresh
& $MyInvocation.MyCommand.Path

