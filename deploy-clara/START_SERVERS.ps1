Write-Host "========================================" -ForegroundColor Green
Write-Host "Starting All Servers" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Starting Unified Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\apps\server'; Write-Host 'Unified Server (Port 8080)' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 3

Write-Host "Starting Client App..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\apps\client'; Write-Host 'Client App (Port 5173)' -ForegroundColor Cyan; npm run dev"

Start-Sleep -Seconds 2

Write-Host "Starting Staff App..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\apps\staff'; Write-Host 'Staff App (Port 5174)' -ForegroundColor Magenta; npm run dev"

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "ALL SERVERS STARTED - ACCESS LINKS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "CLIENT INTERFACE:" -ForegroundColor Cyan
Write-Host "  http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "STAFF INTERFACE:" -ForegroundColor Magenta
Write-Host "  http://localhost:5174" -ForegroundColor Yellow
Write-Host ""
Write-Host "UNIFIED SERVER API:" -ForegroundColor White
Write-Host "  http://localhost:8080" -ForegroundColor Yellow
Write-Host "  Health: http://localhost:8080/healthz" -ForegroundColor Gray
Write-Host ""
Write-Host "Staff Login (Demo):" -ForegroundColor Cyan
Write-Host "  Email: nagashreen@gmail.com" -ForegroundColor Yellow
Write-Host "  Password: password" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

