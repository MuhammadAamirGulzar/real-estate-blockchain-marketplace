Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RWAChain Admin Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Admin Details:" -ForegroundColor Yellow
Write-Host "  Email: admin@rwachain.com" -ForegroundColor Gray
Write-Host "  Password: admin123" -ForegroundColor Gray
Write-Host "  Wallet: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" -ForegroundColor Gray
Write-Host ""

Write-Host "[1/2] Creating admin in database..." -ForegroundColor Cyan
Set-Location backend
node scripts/create-admin.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create admin in database" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..
Write-Host ""
Write-Host "[2/2] Granting admin role on blockchain..." -ForegroundColor Cyan
Set-Location blockchain
.\grant-admin.ps1
Set-Location ..

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to grant admin role on blockchain" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Admin Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now login with:" -ForegroundColor Yellow
Write-Host "  Email: admin@rwachain.com" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host "  Wallet: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" -ForegroundColor White
