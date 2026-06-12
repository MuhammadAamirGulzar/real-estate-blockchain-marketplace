#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy a single smart contract with dependency resolution
    
.DESCRIPTION
    Modular deployment script for individual contracts. Automatically loads
    dependency addresses from .env and validates prerequisites.
    
.PARAMETER ContractName
    Name of the contract to deploy (e.g., "RoleManager", "KYCRegistry")
    
.PARAMETER Network
    Target network: localhost, sepolia
    
.PARAMETER UpdateEnv
    Update .env file with deployed address
    
.PARAMETER SyncBackend
    Sync deployed address to backend addresses.json
    
.EXAMPLE
    .\deploy-single.ps1 -ContractName RoleManager -Network localhost
    
.EXAMPLE
    .\deploy-single.ps1 -ContractName PaymentSystem -Network sepolia -UpdateEnv -SyncBackend
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("RoleManager", "KYCRegistry", "AssetRegistry", "PropertyNFT", "RWAToken", 
                 "InvestmentManager", "SecondaryMarket", "RevenueDistributor", "PaymentSystem")]
    [string]$ContractName,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("localhost", "sepolia")]
    [string]$Network = "localhost",
    
    [Parameter(Mandatory=$false)]
    [switch]$UpdateEnv,
    
    [Parameter(Mandatory=$false)]
    [switch]$SyncBackend
)

$ErrorActionPreference = "Stop"

# === PATH CONFIGURATION ===
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BlockchainDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $BlockchainDir
$BackendDir = Join-Path $RootDir "backend"
$EnvFile = Join-Path $BlockchainDir ".env"
$AddressesFile = Join-Path $BackendDir "services\web3\addresses.json"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Single Contract Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Contract: $ContractName" -ForegroundColor White
Write-Host "Network:  $Network" -ForegroundColor White
Write-Host ""

# === LOAD ENVIRONMENT ===
Write-Host "[1/4] Loading environment..." -ForegroundColor Yellow

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
Write-Host "`n[2/4] Validating prerequisites..." -ForegroundColor Yellow

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
$requiredEnvVars = @('RPC_URL', 'PRIVATE_KEY')
foreach ($var in $requiredEnvVars) {
    if (-not (Get-Item -Path "env:$var" -ErrorAction SilentlyContinue)) {
        Write-Error "Required environment variable $var not set"
        exit 1
    }
}

# === CHECK DEPENDENCIES ===
$contractInfo = @{
    "RoleManager" = @{Script="DeployRoleManager"; Deps=@()}
    "KYCRegistry" = @{Script="DeployKYCRegistry"; Deps=@("ROLE_MANAGER_ADDRESS")}
    "AssetRegistry" = @{Script="DeployAssetRegistry"; Deps=@("ROLE_MANAGER_ADDRESS", "KYC_REGISTRY_ADDRESS")}
    "PropertyNFT" = @{Script="DeployPropertyNFT"; Deps=@("ASSET_REGISTRY_ADDRESS")}
    "RWAToken" = @{Script="DeployRWAToken"; Deps=@()}
    "InvestmentManager" = @{Script="DeployInvestmentManager"; Deps=@("PROPERTY_NFT_ADDRESS", "RWA_TOKEN_ADDRESS", "KYC_REGISTRY_ADDRESS")}
    "SecondaryMarket" = @{Script="DeploySecondaryMarket"; Deps=@("RWA_TOKEN_ADDRESS", "KYC_REGISTRY_ADDRESS", "ASSET_REGISTRY_ADDRESS")}
    "RevenueDistributor" = @{Script="DeployRevenueDistributor"; Deps=@("RWA_TOKEN_ADDRESS", "ASSET_REGISTRY_ADDRESS")}
    "PaymentSystem" = @{Script="DeployPaymentSystem"; Deps=@("RWA_TOKEN_ADDRESS", "INVESTMENT_MANAGER_ADDRESS")}
}

$contract = $contractInfo[$ContractName]
$missingDeps = @()

foreach ($dep in $contract.Deps) {
    $depValue = [System.Environment]::GetEnvironmentVariable($dep)
    if (-not $depValue -or $depValue -eq "") {
        $missingDeps += $dep
        Write-Host "  ✗ Missing dependency: $dep" -ForegroundColor Red
    } else {
        Write-Host "  ✓ Dependency $dep = $depValue" -ForegroundColor Green
    }
}

if ($missingDeps.Count -gt 0) {
    Write-Error "Missing required dependencies. Deploy them first or set in .env"
    exit 1
}

# === DEPLOY CONTRACT ===
Write-Host "`n[3/4] Deploying $ContractName..." -ForegroundColor Yellow

Set-Location $BlockchainDir

try {
    $scriptPath = "script/$($contract.Script).s.sol"
    $forgeArgs = @($scriptPath, "--rpc-url", $env:RPC_URL, "--broadcast", "--private-key", $env:PRIVATE_KEY, "--via-ir")
    
    $output = & forge script $forgeArgs 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Forge script failed with exit code $LASTEXITCODE"
    }
    
    Write-Host "  ✓ Deployment transaction sent" -ForegroundColor Green
    
    # Get chain ID
    $chainId = (cast chain-id --rpc-url $env:RPC_URL).Trim()
    
    # Extract addresses
    $broadcastPath = "broadcast/$($contract.Script).s.sol/$chainId/run-latest.json"
    
    if (-not (Test-Path $broadcastPath)) {
        throw "Broadcast file not found: $broadcastPath"
    }
    
    $broadcast = Get-Content $broadcastPath | ConvertFrom-Json
    
    # Handle PaymentSystem (3 contracts)
    if ($ContractName -eq "PaymentSystem") {
        $proxyDeployments = $broadcast.transactions | Where-Object { 
            $_.transactionType -eq "CREATE" -and $_.contractName -match "ERC1967Proxy"
        }
        
        if ($proxyDeployments.Count -ge 3) {
            $priceOracleAddr = $proxyDeployments[0].contractAddress
            $paymentEscrowAddr = $proxyDeployments[1].contractAddress
            $multiTokenPaymentAddr = $proxyDeployments[2].contractAddress
            
            Write-Host "`n  Deployed Addresses:" -ForegroundColor White
            Write-Host "    PriceOracle:        $priceOracleAddr" -ForegroundColor Gray
            Write-Host "    PaymentEscrow:      $paymentEscrowAddr" -ForegroundColor Gray
            Write-Host "    MultiTokenPayment:  $multiTokenPaymentAddr" -ForegroundColor Gray
            
            $deployedAddresses = @{
                "PRICE_ORACLE_ADDRESS" = $priceOracleAddr
                "PAYMENT_ESCROW_ADDRESS" = $paymentEscrowAddr
                "MULTI_TOKEN_PAYMENT_ADDRESS" = $multiTokenPaymentAddr
            }
        } else {
            throw "PaymentSystem did not deploy 3 proxy contracts"
        }
    } else {
        # Single contract
        $proxyDeployment = $broadcast.transactions | Where-Object { 
            $_.transactionType -eq "CREATE" -and $_.contractName -eq "ERC1967Proxy"
        } | Select-Object -First 1
        
        if (-not $proxyDeployment) {
            throw "No proxy deployment found"
        }
        
        $address = $proxyDeployment.contractAddress
        $envKey = "$($ContractName.ToUpper())_ADDRESS"
        
        Write-Host "`n  Deployed Address:" -ForegroundColor White
        Write-Host "    $ContractName: $address" -ForegroundColor Gray
        
        $deployedAddresses = @{
            $envKey = $address
        }
    }
    
    Write-Host "`n  ✓ $ContractName deployed successfully!" -ForegroundColor Green
    
} catch {
    Write-Host "  ✗ Deployment failed" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
    exit 1
}

# === UPDATE .ENV ===
if ($UpdateEnv) {
    Write-Host "`n[4/4] Updating .env file..." -ForegroundColor Yellow
    
    try {
        $envContent = Get-Content $EnvFile
        
        foreach ($key in $deployedAddresses.Keys) {
            $value = $deployedAddresses[$key]
            $found = $false
            
            for ($i = 0; $i -lt $envContent.Count; $i++) {
                if ($envContent[$i] -match "^\s*$key\s*=") {
                    $envContent[$i] = "$key=$value"
                    $found = $true
                    break
                }
            }
            
            if (-not $found) {
                $envContent += "$key=$value"
            }
        }
        
        $envContent | Set-Content $EnvFile
        Write-Host "  ✓ Updated $EnvFile" -ForegroundColor Green
        
    } catch {
        Write-Host "  ⚠ Failed to update .env" -ForegroundColor Yellow
        Write-Host "    Error: $_" -ForegroundColor Gray
    }
}

# === SYNC TO BACKEND ===
if ($SyncBackend) {
    Write-Host "`nSyncing to backend..." -ForegroundColor Yellow
    
    try {
        $backendServicesDir = Join-Path $BackendDir "services\web3"
        if (-not (Test-Path $backendServicesDir)) {
            New-Item -ItemType Directory -Path $backendServicesDir -Force | Out-Null
        }
        
        $addresses = @{}
        if (Test-Path $AddressesFile) {
            $addresses = Get-Content $AddressesFile | ConvertFrom-Json -AsHashtable
        }
        
        if (-not $addresses.ContainsKey($chainId)) {
            $addresses[$chainId] = @{}
        }
        
        # Map env keys to contract names
        $keyMapping = @{
            "ROLEMANAGER_ADDRESS" = "RoleManager"
            "KYCREGISTRY_ADDRESS" = "KYCRegistry"
            "ASSETREGISTRY_ADDRESS" = "AssetRegistry"
            "PROPERTYNFT_ADDRESS" = "PropertyNFT"
            "RWATOKEN_ADDRESS" = "RWAToken"
            "INVESTMENTMANAGER_ADDRESS" = "InvestmentManager"
            "SECONDARYMARKET_ADDRESS" = "SecondaryMarket"
            "REVENUEDISTRIBUTOR_ADDRESS" = "RevenueDistributor"
            "PRICE_ORACLE_ADDRESS" = "PriceOracle"
            "PAYMENT_ESCROW_ADDRESS" = "PaymentEscrow"
            "MULTI_TOKEN_PAYMENT_ADDRESS" = "MultiTokenPayment"
        }
        
        foreach ($envKey in $deployedAddresses.Keys) {
            $cName = $keyMapping[$envKey]
            if ($cName) {
                $addresses[$chainId][$cName] = $deployedAddresses[$envKey]
            }
        }
        
        $addresses | ConvertTo-Json -Depth 10 | Set-Content $AddressesFile
        Write-Host "  ✓ Synced to $AddressesFile" -ForegroundColor Green
        
    } catch {
        Write-Host "  ⚠ Failed to sync to backend" -ForegroundColor Yellow
        Write-Host "    Error: $_" -ForegroundColor Gray
    }
}

# === SUMMARY ===
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

foreach ($key in $deployedAddresses.Keys | Sort-Object) {
    Write-Host "  $key = $($deployedAddresses[$key])" -ForegroundColor White
}

Write-Host ""
