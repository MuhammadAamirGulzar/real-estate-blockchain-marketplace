#!/usr/bin/env pwsh
<#!
.SYNOPSIS
  Start RWAchain services with Docker Compose

.DESCRIPTION
  Brings up Postgres, Anvil (blockchain), backend, and frontend containers.
  Shows service status after startup.
#>

$ErrorActionPreference = "Stop"

Write-Host "Starting Docker services..." -ForegroundColor Cyan

# Build and start containers in detached mode. The database and local chain
# are profile-gated so normal app-only compose commands remain lightweight.
& docker compose --profile docker-db --profile docker-chain up --build -d
if ($LASTEXITCODE -ne 0) {
  throw "Docker Compose failed to start. Check Docker Desktop and try again."
}

Write-Host "\nService status:" -ForegroundColor Cyan
& docker compose ps

Write-Host "\nLogs (last 50 lines):" -ForegroundColor Cyan
& docker compose logs --tail 50

Write-Host "\nEndpoints:" -ForegroundColor Cyan
Write-Host "  Frontend  ->  http://localhost:5173" -ForegroundColor Magenta
Write-Host "  Backend   ->  http://localhost:3001" -ForegroundColor Green
Write-Host "  Anvil     ->  http://localhost:8545" -ForegroundColor Cyan
Write-Host "  Postgres  ->  localhost:5432" -ForegroundColor Yellow
