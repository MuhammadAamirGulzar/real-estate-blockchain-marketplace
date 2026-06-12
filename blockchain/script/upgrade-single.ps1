#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Upgrade a single smart contract to a new implementation

.DESCRIPTION
    Modular upgrade script for individual contracts. Automatically loads
    proxy address from .env and validates prerequisites.

.PARAMETER ContractName
    Name of the contract to upgrade (e.g., "RoleManager", "KYCRegistry")

.PARAMETER Network
    Target network: localhost, sepolia

.EXAMPLE
    .\upgrade-single.ps1 -ContractName RoleManager -Network localhost

.EXAMPLE
    .\upgrade-single.ps1 -ContractName PaymentEscrow -Network sepolia
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("RoleManager", "KYCRegistry", "AssetRegistry", "PropertyNFT", "RWAToken", 
                 "InvestmentManager", "SecondaryMarket", "RevenueDistributor", 
                 "PriceOracle", "PaymentEscrow", "MultiTokenPayment")]
    [string]$ContractName,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("localhost", "sepolia")]
    [string]$Network = "localhost"
)

$ErrorActionPreference = "Stop"

# === PATH CONFIGURATION ===
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BlockchainDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $BlockchainDir
$EnvFile = Join-Path $BlockchainDir ".env"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Single Contract Upgrade" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Contract: $ContractName" -ForegroundColor White
Write-Host "Network:  $Network" -ForegroundColor White
Write-Host ""

# === LOAD ENVIRONMENT ===
Write-Host "[1/3] Loading environment..." -ForegroundColor Yellow

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

Write-Host "  ✓ Environment loaded" -ForegroundColor Green

# === VALIDATE PREREQUISITES ===
Write-Host "`n[2/3] Validating prerequisites..." -ForegroundColor Yellow

# Check tools
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

# Check env vars
$requiredEnvVars = @('RPC_URL', 'DEPLOYER_PRIVATE_KEY')
foreach ($var in $requiredEnvVars) {
    if (-not (Get-Item -Path "env:$var" -ErrorAction SilentlyContinue)) {
        Write-Error "Required environment variable $var not set"
        exit 1
    }
}

# === CONTRACT INFO ===
$contractInfo = @{
    "RoleManager" = @{Script="UpgradeRoleManager"; EnvKey="ROLEMANAGER_ADDRESS"}
    "KYCRegistry" = @{Script="UpgradeKYCRegistry"; EnvKey="KYCREGISTRY_ADDRESS"}
    "AssetRegistry" = @{Script="UpgradeAssetRegistry"; EnvKey="ASSETREGISTRY_ADDRESS"}
    "PropertyNFT" = @{Script="UpgradePropertyNFT"; EnvKey="PROPERTYNFT_ADDRESS"}
    "RWAToken" = @{Script="UpgradeRWAToken"; EnvKey="RWATOKEN_ADDRESS"}
    "InvestmentManager" = @{Script="UpgradeInvestmentManager"; EnvKey="INVESTMENTMANAGER_ADDRESS"}
    "SecondaryMarket" = @{Script="UpgradeSecondaryMarket"; EnvKey="SECONDARYMARKET_ADDRESS"}
    "RevenueDistributor" = @{Script="UpgradeRevenueDistributor"; EnvKey="REVENUEDISTRIBUTOR_ADDRESS"}
    "PriceOracle" = @{Script="UpgradePriceOracle"; EnvKey="PRICE_ORACLE_ADDRESS"}
    "PaymentEscrow" = @{Script="UpgradePaymentEscrow"; EnvKey="PAYMENT_ESCROW_ADDRESS"}
    "MultiTokenPayment" = @{Script="UpgradeMultiTokenPayment"; EnvKey="MULTI_TOKEN_PAYMENT_ADDRESS"}
}

$contract = $contractInfo[$ContractName]

# Check proxy address
$proxyAddress = [System.Environment]::GetEnvironmentVariable($contract.EnvKey)

if (-not $proxyAddress -or $proxyAddress -eq "") {
    Write-Error "No proxy address found for $($contract.EnvKey). Deploy the contract first."
    exit 1
}

Write-Host "  ✓ Proxy Address: $proxyAddress" -ForegroundColor Green

# === UPGRADE CONTRACT ===
Write-Host "`n[3/3] Upgrading $ContractName..." -ForegroundColor Yellow

Set-Location $BlockchainDir

try {
    $scriptPath = "script/$($contract.Script).s.sol"
    $forgeArgs = @($scriptPath, "--rpc-url", $env:RPC_URL, "--broadcast", "--private-key", $env:DEPLOYER_PRIVATE_KEY, "--via-ir")
    
    $output = & forge script $forgeArgs 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Forge script failed with exit code $LASTEXITCODE"
    }
    
    Write-Host "  ✓ Upgrade transaction sent" -ForegroundColor Green
    
    # Get chain ID
    $chainId = (cast chain-id --rpc-url $env:RPC_URL).Trim()
    
    # Extract new implementation
    $broadcastPath = "broadcast/$($contract.Script).s.sol/$chainId/run-latest.json"
    
    if (-not (Test-Path $broadcastPath)) {
        throw "Broadcast file not found: $broadcastPath"
    }
    
    $broadcast = Get-Content $broadcastPath | ConvertFrom-Json
    
    # Find new implementation
    $implDeployment = $broadcast.transactions | Where-Object { 
        $_.transactionType -eq "CREATE" -and $_.contractName -eq $ContractName
    } | Select-Object -First 1
    
    if ($implDeployment) {
        $newImplAddress = $implDeployment.contractAddress
        
        Write-Host "`n  Upgrade Details:" -ForegroundColor White
        Write-Host "    Proxy Address:          $proxyAddress" -ForegroundColor Gray
        Write-Host "    New Implementation:     $newImplAddress" -ForegroundColor Gray
    }
    
    Write-Host "`n  ✓ $ContractName upgraded successfully!" -ForegroundColor Green
    
} catch {
    Write-Host "  ✗ Upgrade failed" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
    exit 1
}

# === SUMMARY ===
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Upgrade Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n✓ $ContractName upgraded to new implementation" -ForegroundColor Green
Write-Host "  Proxy:          $proxyAddress" -ForegroundColor Gray
Write-Host "  Implementation: $newImplAddress" -ForegroundColor Gray

Write-Host ""
