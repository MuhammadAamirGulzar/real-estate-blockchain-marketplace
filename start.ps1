#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start the RWAchain Platform for local development

.DESCRIPTION
    Starts all three services in separate windows:
      1. Anvil    - local blockchain (loads saved state, no redeploy needed)
      2. Backend  - Express API on port 3001
      3. Frontend - Vite dev server on port 5173

.PARAMETER Deploy
    Force a fresh contract deployment before starting (only needed after
    editing Solidity contracts or if anvil-state was deleted).

.PARAMETER Reset
    Nuclear option: drops and recreates the database, then deploys fresh contracts.

.EXAMPLE
    .\start.ps1              # normal daily start
    .\start.ps1 -Deploy      # start + redeploy contracts
    .\start.ps1 -Reset       # wipe DB + redeploy everything
#>

param(
    [switch]$Deploy,
    [switch]$Reset
)

$ErrorActionPreference = "Stop"

$ProjectRoot   = $PSScriptRoot
$BlockchainDir = Join-Path $ProjectRoot "blockchain"
$BackendDir    = Join-Path $ProjectRoot "backend"
$FrontendDir   = Join-Path $ProjectRoot "frontend"
$StateFile     = Join-Path $BlockchainDir "anvil-state\state.json"
$StateDir      = Join-Path $BlockchainDir "anvil-state"

function Banner($text) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Ok($text)   { Write-Host "  [OK] $text" -ForegroundColor Green  }
function Info($text) { Write-Host "  [>>] $text" -ForegroundColor Gray   }
function Warn($text) { Write-Host "  [!]  $text" -ForegroundColor Yellow }

# --- Check required tools ---
Banner "RWAchain Platform - Dev Startup"

foreach ($tool in @('node', 'npm', 'anvil', 'forge', 'cast')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Error "$tool not found. Install Foundry + Node.js and re-run."
        exit 1
    }
}
Ok "All required tools found"

# --- Optional: full reset ---
if ($Reset) {
    Warn "RESET mode - database will be wiped and contracts redeployed."
    Write-Host ""
    $confirm = Read-Host "  Type YES to continue"
    if ($confirm -ne "YES") {
        Write-Host "  Aborted."
        exit 0
    }

    Info "Resetting database..."
    Set-Location $BackendDir
    & npm run db:reset   2>&1 | ForEach-Object { "  $_" }
    & npm run db:migrate 2>&1 | ForEach-Object { "  $_" }
    & npm run db:seed    2>&1 | ForEach-Object { "  $_" }
    Ok "Database reset complete"

    $Deploy = $true
}

# --- Ensure state directory exists ---
if (-not (Test-Path $StateDir)) {
    New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
}

# --- Start Anvil ---
Info "Starting Anvil..."

$anvilArgs = "--chain-id 31337 --dump-state `"$StateFile`""
if (Test-Path $StateFile) {
    $anvilArgs = "--load-state `"$StateFile`" " + $anvilArgs
    Ok "Anvil: loading saved state (contracts already deployed)"
} else {
    Warn "Anvil: no saved state found - starting fresh"
    $Deploy = $true
}

Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$BlockchainDir'; Write-Host 'ANVIL' -ForegroundColor Cyan; anvil $anvilArgs" `
    -WindowStyle Normal

# Wait for Anvil to be ready
Info "Waiting for Anvil to be ready..."
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:8545" -Method Post `
             -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' `
             -ContentType "application/json" -TimeoutSec 1 -ErrorAction Stop
        if ($r.result) {
            $ready = $true
            break
        }
    } catch { }
}

if (-not $ready) {
    Write-Error "Anvil did not start within 10 seconds. Check the Anvil window for errors."
    exit 1
}
Ok "Anvil is running on http://127.0.0.1:8545"

# --- Optional: deploy contracts ---
if ($Deploy) {
    Info "Deploying contracts..."
    Set-Location $BlockchainDir
    & .\script\deploy-all.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Contract deployment failed. Check output above."
        exit 1
    }
    Ok "Contracts deployed and addresses synced"

    $syncScript = Join-Path $BackendDir "scripts\sync-after-deployment.js"
    if (Test-Path $syncScript) {
        Info "Syncing on-chain roles..."
        Set-Location $BackendDir
        & node $syncScript 2>&1 | ForEach-Object { "  $_" }
        Ok "On-chain roles synced"
    }
}

# --- Start Backend ---
Info "Starting Backend API (port 3001)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$BackendDir'; Write-Host 'BACKEND' -ForegroundColor Green; npm run dev" `
    -WindowStyle Normal

# Wait for backend to be ready
Info "Waiting for backend to be ready..."
$backendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 1 -ErrorAction Stop
        if ($r.status -eq "ok") {
            $backendReady = $true
            break
        }
    } catch { }
}

if ($backendReady) {
    Ok "Backend is running on http://localhost:3001"
} else {
    Warn "Backend health check timed out - it may still be starting. Check the backend window."
}

# --- Start Frontend ---
Info "Starting Frontend (port 5173)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$FrontendDir'; Write-Host 'FRONTEND' -ForegroundColor Magenta; npm run dev" `
    -WindowStyle Normal

# --- Done ---
Banner "All Services Started"

Write-Host "  Frontend  ->  http://localhost:5173" -ForegroundColor Magenta
Write-Host "  Backend   ->  http://localhost:3001" -ForegroundColor Green
Write-Host "  Anvil     ->  http://127.0.0.1:8545" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Test Accounts:" -ForegroundColor White
Write-Host "    Admin    admin@rwachain.com    / admin123" -ForegroundColor Gray
Write-Host "    SubAdmin subadmin@rwachain.com / subadmin123" -ForegroundColor Gray
Write-Host "    User     user@example.com      / password123" -ForegroundColor Gray
Write-Host "    Verifier verifier@rwachain.com / verifier123" -ForegroundColor Gray
Write-Host ""
Write-Host "  Usage:" -ForegroundColor White
Write-Host "    .\start.ps1          # daily start (no redeploy)" -ForegroundColor Gray
Write-Host "    .\start.ps1 -Deploy  # start + redeploy contracts" -ForegroundColor Gray
Write-Host "    .\start.ps1 -Reset   # wipe DB + fresh deploy" -ForegroundColor Gray
Write-Host ""