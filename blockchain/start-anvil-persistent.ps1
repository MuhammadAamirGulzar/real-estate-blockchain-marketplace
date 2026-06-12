$StateDir = "anvil-state"

if (-not (Test-Path $StateDir)) {
    New-Item -ItemType Directory -Path $StateDir | Out-Null
    Write-Host "Created state directory: $StateDir" -ForegroundColor Green
}

Write-Host "Starting Anvil with persistent state..." -ForegroundColor Cyan
Write-Host "State will be saved to: $StateDir" -ForegroundColor Gray
Write-Host ""

anvil --state $StateDir --state-interval 10
