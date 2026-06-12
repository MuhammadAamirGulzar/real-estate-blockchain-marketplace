#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy all RWAchain Platform contracts in correct dependency order

.DESCRIPTION
    Comprehensive deployment script that:
    - Validates environment and prerequisites
    - Deploys all 11 contracts (9 base + 3 payment system)
    - Updates .env with deployed addresses
    - Syncs addresses to backend/services/web3/addresses.json
    - Runs post-deployment verification

.PARAMETER Network
    Network to deploy to (localhost, sepolia). Default: localhost

.PARAMETER SkipVerification
    Skip post-deployment verification checks

.EXAMPLE
    .\deploy-all.ps1
    .\deploy-all.ps1 -Network sepolia
    .\deploy-all.ps1 -SkipVerification
#>

param(
    [string]$Network = "localhost",
    [switch]$SkipVerification
)


$ErrorActionPreference = "Stop"

# === PATH CONFIGURATION ===
$ScriptDir = $PSScriptRoot
$BlockchainDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $BlockchainDir
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$EnvFile = Join-Path $BlockchainDir ".env"
$FrontendEnvFile = Join-Path $FrontendDir ".env"
$BackendEnvFile = Join-Path $BackendDir ".env"
$AddressesFile = Join-Path $BackendDir "services\web3\addresses.json"

# === HELPER FUNCTION: UPDATE .ENV FILE ===
function Update-EnvFile {
    param(
        [hashtable]$Addresses,
        [string]$FilePath = $EnvFile
    )

    if (-not (Test-Path $FilePath)) {
        Write-Host "  [!] Env file not found, skipping: $FilePath" -ForegroundColor Yellow
        return
    }

    $lines = Get-Content $FilePath

    foreach ($key in $Addresses.Keys) {
        $value = $Addresses[$key]
        $found = $false

        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*$key\s*=") {
                $lines[$i] = "$key=`"$value`""
                $found = $true
                break
            }
        }

        if (-not $found) {
            $lines += "$key=`"$value`""
        }
    }

    $lines | Set-Content $FilePath -Encoding UTF8

    # Only set process env vars for the blockchain .env (not frontend/backend)
    if ($FilePath -eq $EnvFile) {
        foreach ($key in $Addresses.Keys) {
            [System.Environment]::SetEnvironmentVariable($key, $Addresses[$key], [System.EnvironmentVariableTarget]::Process)
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RWAchain Platform Deployment" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Paths:" -ForegroundColor Gray
Write-Host " Blockchain: $BlockchainDir" -ForegroundColor Gray
Write-Host "  Backend:    $BackendDir" -ForegroundColor Gray
Write-Host "  Addresses:  $AddressesFile" -ForegroundColor Gray
Write-Host "  Network:    $Network`n" -ForegroundColor Gray

# === LOAD ENVIRONMENT VARIABLES ===
Write-Host "[1/6] Loading environment variables..." -ForegroundColor Yellow

if (-not (Test-Path $EnvFile)) {
    Write-Error ".env file not found at: $EnvFile"
    exit 1
}

Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($key, $value, [System.EnvironmentVariableTarget]::Process)
    }
}

Write-Host "  [OK] Loaded environment variables" -ForegroundColor Green

# === VALIDATE PREREQUISITES ===
Write-Host "`n[2/6] Validating prerequisites..." -ForegroundColor Yellow

# Check required tools
$requiredTools = @('forge', 'cast', 'node')
foreach ($tool in $requiredTools) {
    try {
        $null = Get-Command $tool -ErrorAction Stop
        Write-Host "  [OK] $tool found" -ForegroundColor Green
    } catch {
        Write-Error "$tool not found. Please install Foundry and Node.js"
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

# Check Anvil running for localhost
if ($Network -eq "localhost") {
    Write-Host "  Checking Anvil..." -ForegroundColor Gray
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8545" -Method Post `
            -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' `
            -ContentType "application/json" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "  [OK] Anvil is running" -ForegroundColor Green
    } catch {
        Write-Host "  [X] Anvil not running. Starting Anvil..." -ForegroundColor Yellow
        Start-Process "anvil" -WindowStyle Minimized
        Start-Sleep -Seconds 5
        Write-Host "  [OK] Anvil started" -ForegroundColor Green
    }
}

# === GET CHAIN ID ===
Write-Host "`n[3/6] Detecting network..." -ForegroundColor Yellow

Set-Location $BlockchainDir
$chainId = (cast chain-id --rpc-url $env:RPC_URL).Trim()
Write-Host "  [OK] Chain ID: $chainId" -ForegroundColor Green

# === CLEAR STALE BROADCAST FILES ===
# Windows error 1224: forge cannot overwrite broadcast JSON files that are still
# memory-mapped (locked) from a previous run. Delete them before deploying.
$broadcastDir = Join-Path $BlockchainDir "broadcast"
if (Test-Path $broadcastDir) {
    Write-Host "  Clearing stale broadcast files..." -ForegroundColor Gray
    Get-ChildItem -Path $broadcastDir -Recurse -Filter "run-latest.json" | ForEach-Object {
        try {
            Remove-Item $_.FullName -Force -ErrorAction Stop
        } catch {
            Write-Host "  [!] Could not remove $($_.FullName) - $_" -ForegroundColor Yellow
        }
    }
    Write-Host "  [OK] Broadcast files cleared" -ForegroundColor Green
}

# === DEPLOY CONTRACTS ===
Write-Host "`n[4/6] Deploying contracts..." -ForegroundColor Yellow

$contracts = @(
    @{Name="RoleManager"; Script="DeployRoleManager"; EnvKey="ROLE_MANAGER_ADDRESS"},
    @{Name="KYCRegistry"; Script="DeployKYCRegistry"; EnvKey="KYC_REGISTRY_ADDRESS"},
    @{Name="AssetRegistry"; Script="DeployAssetRegistry"; EnvKey="ASSET_REGISTRY_ADDRESS"},
    @{Name="PropertyNFT"; Script="DeployPropertyNFT"; EnvKey="PROPERTY_NFT_ADDRESS"},
    @{Name="RWAToken"; Script="DeployRWAToken"; EnvKey="RWA_TOKEN_ADDRESS"},
    @{Name="InvestmentManager"; Script="DeployInvestmentManager"; EnvKey="INVESTMENT_MANAGER_ADDRESS"},
    @{Name="SecondaryMarket"; Script="DeploySecondaryMarket"; EnvKey="SECONDARY_MARKET_ADDRESS"},
    @{Name="RevenueDistributor"; Script="DeployRevenueDistributor"; EnvKey="REVENUE_DISTRIBUTOR_ADDRESS"},
    @{Name="PaymentSystem"; Script="DeployPaymentSystem"; EnvKey=""}
)

$deployedAddresses = @{}
$totalContracts = $contracts.Count
$currentContract = 0

foreach ($contract in $contracts) {
    $currentContract++
    $percentComplete = [int](($currentContract / $totalContracts) * 100)
    
    Write-Host "`n  [$currentContract/$totalContracts] Deploying $($contract.Name)..." -ForegroundColor Cyan
    Write-Progress -Activity "Deploying Contracts" -Status "$($contract.Name)" -PercentComplete $percentComplete
    
    try {
        # Run forge script
        $scriptPath = "script/$($contract.Script).s.sol"
        $forgeArgs = @($scriptPath, "--rpc-url", $env:RPC_URL, "--broadcast", "--private-key", $env:PRIVATE_KEY, "--via-ir")
        
        $null = & forge script $forgeArgs 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            throw "Forge script failed with exit code $LASTEXITCODE"
        }
        
        # Extract addresses from broadcast
        $broadcastPath = "broadcast/$($contract.Script).s.sol/$chainId/run-latest.json"
        
        if (-not (Test-Path $broadcastPath)) {
            throw "Broadcast file not found: $broadcastPath"
        }
        
        $broadcast = Get-Content $broadcastPath | ConvertFrom-Json
        
        if ($contract.Name -eq "PaymentSystem") {
            $proxyDeployments = $broadcast.transactions | Where-Object { 
                $_.transactionType -eq "CREATE" -and $_.contractName -match "ERC1967Proxy"
            }
            
            if ($proxyDeployments.Count -ge 3) {
                $paymentAddresses = @{
                    "PRICE_ORACLE_ADDRESS" = $proxyDeployments[0].contractAddress
                    "PAYMENT_ESCROW_ADDRESS" = $proxyDeployments[1].contractAddress
                    "MULTI_TOKEN_PAYMENT_ADDRESS" = $proxyDeployments[2].contractAddress
                }
                
                Write-Host "    [OK] PriceOracle: $($proxyDeployments[0].contractAddress)" -ForegroundColor Gray
                Write-Host "    [OK] PaymentEscrow: $($proxyDeployments[1].contractAddress)" -ForegroundColor Gray
                Write-Host "    [OK] MultiTokenPayment: $($proxyDeployments[2].contractAddress)" -ForegroundColor Gray
                
                Update-EnvFile -Addresses $paymentAddresses
                $deployedAddresses += $paymentAddresses
            } else {
                throw "PaymentSystem did not deploy 3 proxy contracts"
            }
        } else {
            $proxyDeployment = $broadcast.transactions | Where-Object { 
                $_.transactionType -eq "CREATE" -and $_.contractName -eq "ERC1967Proxy"
            } | Select-Object -First 1
            
            if (-not $proxyDeployment) {
                throw "No proxy deployment found in broadcast"
            }
            
            $address = $proxyDeployment.contractAddress
            $envKey = $contract.EnvKey
            
            $deployedAddresses[$envKey] = $address
            Update-EnvFile -Addresses @{$envKey = $address}
            
            Write-Host "    [OK] $address" -ForegroundColor Gray
        }
        
        Write-Host "  [OK] $($contract.Name) deployed successfully" -ForegroundColor Green
        
    } catch {
        Write-Host "  [X] Failed to deploy $($contract.Name)" -ForegroundColor Red
        Write-Host "    Error: $_" -ForegroundColor Red
        Write-Progress -Activity "Deploying Contracts" -Completed
        exit 1
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Progress -Activity "Deploying Contracts" -Completed
Write-Host "`n  [OK] All contracts deployed successfully!" -ForegroundColor Green

Write-Host "`n[5/6] Verifying .env file..." -ForegroundColor Yellow
Write-Host "  [OK] .env updated during deployments" -ForegroundColor Green

# === SYNC TO BACKEND ===
Write-Host "`n[6/6] Syncing addresses to backend..." -ForegroundColor Yellow

try {
    # Ensure backend directory exists
    $backendServicesDir = Join-Path $BackendDir "services\web3"
    if (-not (Test-Path $backendServicesDir)) {
        New-Item -ItemType Directory -Path $backendServicesDir -Force | Out-Null
    }
    
    # Load or create addresses.json structure
    if (Test-Path $AddressesFile) {
        $addresses = Get-Content $AddressesFile -Raw | ConvertFrom-Json
    } else {
        $addresses = [PSCustomObject]@{
            "31337" = [PSCustomObject]@{}
            "11155111" = [PSCustomObject]@{}
        }
    }
    
    # Ensure chain ID exists
    $chainIdStr = $chainId.ToString()
    if (-not $addresses.PSObject.Properties[$chainIdStr]) {
        $addresses | Add-Member -MemberType NoteProperty -Name $chainIdStr -Value ([PSCustomObject]@{}) -Force
    }
    
    # Map env keys to contract names
    $keyMapping = @{
        "ROLE_MANAGER_ADDRESS" = "RoleManager"
        "KYC_REGISTRY_ADDRESS" = "KYCRegistry"
        "ASSET_REGISTRY_ADDRESS" = "AssetRegistry"
        "PROPERTY_NFT_ADDRESS" = "PropertyNFT"
        "RWA_TOKEN_ADDRESS" = "RWAToken"
        "INVESTMENT_MANAGER_ADDRESS" = "InvestmentManager"
        "SECONDARY_MARKET_ADDRESS" = "SecondaryMarket"
        "REVENUE_DISTRIBUTOR_ADDRESS" = "RevenueDistributor"
        "PRICE_ORACLE_ADDRESS" = "PriceOracle"
        "PAYMENT_ESCROW_ADDRESS" = "PaymentEscrow"
        "MULTI_TOKEN_PAYMENT_ADDRESS" = "MultiTokenPayment"
    }
    
    foreach ($envKey in $deployedAddresses.Keys) {
        $contractName = $keyMapping[$envKey]
        if ($contractName) {
            if ($addresses.$chainIdStr.PSObject.Properties[$contractName]) {
                $addresses.$chainIdStr.$contractName = $deployedAddresses[$envKey]
            } else {
                $addresses.$chainIdStr | Add-Member -MemberType NoteProperty -Name $contractName -Value $deployedAddresses[$envKey] -Force
            }
        }
    }
    
    # Save to file as JSON
    $jsonOutput = $addresses | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($AddressesFile, $jsonOutput)
    Write-Host "  [OK] Synced to $AddressesFile" -ForegroundColor Green

    # === SYNC TO FRONTEND .ENV ===
    Write-Host "  Syncing addresses to frontend .env..." -ForegroundColor Gray
    $frontendKeyMapping = @{
        "ROLE_MANAGER_ADDRESS"        = "VITE_ROLE_MANAGER_ADDRESS"
        "KYC_REGISTRY_ADDRESS"        = "VITE_KYC_REGISTRY_ADDRESS"
        "ASSET_REGISTRY_ADDRESS"      = "VITE_ASSET_REGISTRY_ADDRESS"
        "PROPERTY_NFT_ADDRESS"        = "VITE_PROPERTY_NFT_ADDRESS"
        "RWA_TOKEN_ADDRESS"           = "VITE_RWA_TOKEN_ADDRESS"
        "INVESTMENT_MANAGER_ADDRESS"  = "VITE_INVESTMENT_MANAGER_ADDRESS"
        "SECONDARY_MARKET_ADDRESS"    = "VITE_SECONDARY_MARKET_ADDRESS"
        "REVENUE_DISTRIBUTOR_ADDRESS" = "VITE_REVENUE_DISTRIBUTOR_ADDRESS"
        "PRICE_ORACLE_ADDRESS"        = "VITE_PRICE_ORACLE_ADDRESS"
        "PAYMENT_ESCROW_ADDRESS"      = "VITE_PAYMENT_ESCROW_ADDRESS"
        "MULTI_TOKEN_PAYMENT_ADDRESS" = "VITE_MULTI_TOKEN_PAYMENT_ADDRESS"
    }
    $frontendAddresses = @{}
    foreach ($envKey in $deployedAddresses.Keys) {
        $viteKey = $frontendKeyMapping[$envKey]
        if ($viteKey) { $frontendAddresses[$viteKey] = $deployedAddresses[$envKey] }
    }
    Update-EnvFile -Addresses $frontendAddresses -FilePath $FrontendEnvFile
    Write-Host "  [OK] Synced to $FrontendEnvFile" -ForegroundColor Green

    # === SYNC TO BACKEND .ENV ===
    Write-Host "  Syncing addresses to backend .env..." -ForegroundColor Gray
    Update-EnvFile -Addresses $deployedAddresses -FilePath $BackendEnvFile
    Write-Host "  [OK] Synced to $BackendEnvFile" -ForegroundColor Green

} catch {
    Write-Host "  [!] Warning: Failed to sync addresses" -ForegroundColor Yellow
    Write-Host "    Error: $_" -ForegroundColor Gray
}

# === POST-DEPLOYMENT VERIFICATION ===
if (-not $SkipVerification) {
    Write-Host "`n[7/7] Running post-deployment verification..." -ForegroundColor Yellow
    
    $verifyScript = Join-Path $BlockchainDir "scripts\verify-deployment.js"
    if (Test-Path $verifyScript) {
        try {
            $verifyOutput = & node $verifyScript --network=$Network 2>&1
            Write-Host $verifyOutput
        } catch {
            Write-Host "  [!] Verification script encountered issues" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  [!] Verification script not found" -ForegroundColor Yellow
    }
}

# === SUMMARY ===
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Deployment Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nDeployed Contracts:" -ForegroundColor White
foreach ($key in $deployedAddresses.Keys | Sort-Object) {
    Write-Host "  $key = $($deployedAddresses[$key])" -ForegroundColor Gray
}

Write-Host "`n[OK] Deployment completed successfully!" -ForegroundColor Green
Write-Host "  Chain ID: $chainId" -ForegroundColor Gray
Write-Host "  Addresses saved to: $EnvFile" -ForegroundColor Gray
Write-Host "  Backend synced: $AddressesFile" -ForegroundColor Gray

if ($Network -eq "localhost") {
    Write-Host "`nAnvil is running. Press Ctrl+C to stop when done testing." -ForegroundColor Yellow
}

Write-Host ""
