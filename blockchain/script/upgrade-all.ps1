#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Upgrade all deployed RWAchain Platform contracts to new implementations

.DESCRIPTION
    Comprehensive upgrade script that:
    - Validates environment and prerequisites
    - Loads existing contract addresses from .env
    - Upgrades all 11 contracts (9 base + 3 payment system)
    - Preserves contract state and configurations
    - Runs post-upgrade verification

.PARAMETER Network
    Network to upgrade on (localhost, sepolia). Default: localhost

.PARAMETER ContractsToUpgrade
    Comma-separated list of contracts to upgrade. If not specified, upgrades all.
    Example: "RoleManager,KYCRegistry"

.PARAMETER SkipVerification
    Skip post-upgrade verification checks
#>

.EXAMPLE
    .\upgrade-all.ps1

.EXAMPLE
    .\upgrade-all.ps1 -Network sepolia

.EXAMPLE
    .\upgrade-all.ps1 -ContractsToUpgrade "RoleManager,KYCRegistry"
#>

param(
    [string]$Network = "localhost",
    [string]$ContractsToUpgrade = "",
    [switch]$SkipVerification
)

$ErrorActionPreference = "Stop"

# === PATH CONFIGURATION ===
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BlockchainDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $BlockchainDir
$BackendDir = Join-Path $RootDir "backend"
$EnvFile = Join-Path $BlockchainDir ".env"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RWAchain Contract Upgrade System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Network: $Network" -ForegroundColor White
Write-Host ""

# === LOAD ENVIRONMENT ===
Write-Host "[1/5] Loading environment..." -ForegroundColor Yellow

if (-not (Test-Path $EnvFile)) {
    Write-Error ".env file not found at $EnvFile"
    exit 1
}

Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $value, [System.EnvironmentVariableTarget]::Process)
    }
}

Write-Host "  ✓ Loaded environment variables" -ForegroundColor Green

# === VALIDATE PREREQUISITES ===
Write-Host "`n[2/5] Validating prerequisites..." -ForegroundColor Yellow

# Check required tools
$requiredTools = @('forge', 'cast')
foreach ($tool in $requiredTools) {
    try {
        $null = Get-Command $tool -ErrorAction Stop
        Write-Host "  ✓ $tool found" -ForegroundColor Green
    } catch {
        Write-Error "$tool not found. Please install Foundry"
        exit 1
    }
}

# Check required env vars
$requiredEnvVars = @('RPC_URL', 'PRIVATE_KEY')
foreach ($var in $requiredEnvVars) {
    if (-not (Get-Item -Path "env:$var" -ErrorAction SilentlyContinue)) {
        Write-Error "Required environment variable $var not set in .env"
        exit 1
    }
}

# === GET CHAIN ID ===
Write-Host "`n[3/5] Detecting network..." -ForegroundColor Yellow

Set-Location $BlockchainDir
$chainId = (cast chain-id --rpc-url $env:RPC_URL).Trim()
Write-Host "  ✓ Chain ID: $chainId" -ForegroundColor Green

# === DEFINE CONTRACTS ===
$allContracts = @(
    @{Name="RoleManager"; Script="UpgradeRoleManager"; EnvKey="ROLEMANAGER_ADDRESS"},
    @{Name="KYCRegistry"; Script="UpgradeKYCRegistry"; EnvKey="KYCREGISTRY_ADDRESS"},
    @{Name="AssetRegistry"; Script="UpgradeAssetRegistry"; EnvKey="ASSETREGISTRY_ADDRESS"},
    @{Name="PropertyNFT"; Script="UpgradePropertyNFT"; EnvKey="PROPERTYNFT_ADDRESS"},
    @{Name="RWAToken"; Script="UpgradeRWAToken"; EnvKey="RWATOKEN_ADDRESS"},
    @{Name="InvestmentManager"; Script="UpgradeInvestmentManager"; EnvKey="INVESTMENTMANAGER_ADDRESS"},
    @{Name="SecondaryMarket"; Script="UpgradeSecondaryMarket"; EnvKey="SECONDARYMARKET_ADDRESS"},
    @{Name="RevenueDistributor"; Script="UpgradeRevenueDistributor"; EnvKey="REVENUEDISTRIBUTOR_ADDRESS"},
    @{Name="PriceOracle"; Script="UpgradePriceOracle"; EnvKey="PRICE_ORACLE_ADDRESS"},
    @{Name="PaymentEscrow"; Script="UpgradePaymentEscrow"; EnvKey="PAYMENT_ESCROW_ADDRESS"},
    @{Name="MultiTokenPayment"; Script="UpgradeMultiTokenPayment"; EnvKey="MULTI_TOKEN_PAYMENT_ADDRESS"}
)

# Filter contracts if specific ones requested
if ($ContractsToUpgrade) {
    $requestedNames = $ContractsToUpgrade -split ',' | ForEach-Object { $_.Trim() }
    $contracts = $allContracts | Where-Object { $requestedNames -contains $_.Name }
    
    if ($contracts.Count -eq 0) {
        Write-Error "No valid contracts specified. Available: $($allContracts.Name -join ', ')"
        exit 1
    }
} else {
    $contracts = $allContracts
}

# === UPGRADE CONTRACTS ===
Write-Host "`n[4/5] Upgrading contracts..." -ForegroundColor Yellow

$upgradedContracts = @{}
$failedContracts = @()
$totalContracts = $contracts.Count
$currentContract = 0

foreach ($contract in $contracts) {
    $currentContract++
    $percentComplete = [int](($currentContract / $totalContracts) * 100)
    
    Write-Host "`n  [$currentContract/$totalContracts] Upgrading $($contract.Name)..." -ForegroundColor Cyan
    Write-Progress -Activity "Upgrading Contracts" -Status "$($contract.Name)" -PercentComplete $percentComplete
    
    # Check if contract address exists
    $proxyAddress = [System.Environment]::GetEnvironmentVariable($contract.EnvKey)
    
    if (-not $proxyAddress -or $proxyAddress -eq "") {
        Write-Host "    ⚠ Skipped: No address found for $($contract.EnvKey)" -ForegroundColor Yellow
        $failedContracts += @{Name=$contract.Name; Reason="Address not set"}
        continue
    }
    
    Write-Host "    Proxy: $proxyAddress" -ForegroundColor Gray
    
    try {
        # Run forge script
        $scriptPath = "script/$($contract.Script).s.sol"
        $forgeArgs = @($scriptPath, "--rpc-url", $env:RPC_URL, "--broadcast", "--private-key", $env:PRIVATE_KEY, "--via-ir")
        
        $output = & forge script $forgeArgs 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            throw "Forge script failed with exit code $LASTEXITCODE"
        }
        
        # Extract new implementation from broadcast
        $broadcastPath = "broadcast/$($contract.Script).s.sol/$chainId/run-latest.json"
        
        if (-not (Test-Path $broadcastPath)) {
            throw "Broadcast file not found: $broadcastPath"
        }
        
        $broadcast = Get-Content $broadcastPath | ConvertFrom-Json
        
        # Find new implementation deployment
        $implDeployment = $broadcast.transactions | Where-Object { 
            $_.transactionType -eq "CREATE" -and $_.contractName -eq $contract.Name
        } | Select-Object -First 1
        
        if ($implDeployment) {
            $newImplAddress = $implDeployment.contractAddress
            $upgradedContracts[$contract.Name] = @{
                Proxy = $proxyAddress
                NewImplementation = $newImplAddress
            }
            Write-Host "    ✓ New Implementation: $newImplAddress" -ForegroundColor Gray
        }
        
        Write-Host "  ✓ $($contract.Name) upgraded successfully" -ForegroundColor Green
        
    } catch {
        Write-Host "  ✗ Failed to upgrade $($contract.Name)" -ForegroundColor Red
        Write-Host "    Error: $_" -ForegroundColor Red
        $failedContracts += @{Name=$contract.Name; Reason=$_.ToString()}
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Progress -Activity "Upgrading Contracts" -Completed

# === POST-UPGRADE VERIFICATION ===
if (-not $SkipVerification -and $upgradedContracts.Count -gt 0) {
    Write-Host "`n[5/5] Running post-upgrade verification..." -ForegroundColor Yellow
    
    $verifyScript = Join-Path $BlockchainDir "scripts\verify-deployment.js"
    if (Test-Path $verifyScript) {
        try {
            $verifyOutput = & node $verifyScript --network=$Network 2>&1
            Write-Host $verifyOutput
        } catch {
            Write-Host "  ⚠ Verification script encountered issues" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠ Verification script not found" -ForegroundColor Yellow
    }
}

# === SUMMARY ===
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Upgrade Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($upgradedContracts.Count -gt 0) {
    Write-Host "`nSuccessfully Upgraded ($($upgradedContracts.Count)):" -ForegroundColor Green
    foreach ($name in $upgradedContracts.Keys | Sort-Object) {
        $info = $upgradedContracts[$name]
        Write-Host "  ✓ $name" -ForegroundColor Green
        Write-Host "    Proxy:          $($info.Proxy)" -ForegroundColor Gray
        Write-Host "    Implementation: $($info.NewImplementation)" -ForegroundColor Gray
    }
}

if ($failedContracts.Count -gt 0) {
    Write-Host "`nFailed/Skipped ($($failedContracts.Count)):" -ForegroundColor Yellow
    foreach ($failed in $failedContracts) {
        Write-Host "  ✗ $($failed.Name): $($failed.Reason)" -ForegroundColor Yellow
    }
}

Write-Host "`n✓ Upgrade process completed!" -ForegroundColor Green
Write-Host "  Chain ID: $chainId" -ForegroundColor Gray
Write-Host "  Upgraded: $($upgradedContracts.Count)/$totalContracts contracts" -ForegroundColor Gray

Write-Host ""
