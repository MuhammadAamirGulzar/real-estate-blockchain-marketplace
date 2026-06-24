# Deployment System Documentation

## Overview

Complete PowerShell-based deployment system for the EstateChain Marketplace smart contracts. Supports automated deployment of all 11 contracts (9 main contracts + 3 payment system contracts) with full address management and backend synchronization.

---

## System Architecture

### Components

1. **deploy-all.ps1** - Complete deployment orchestration
2. **deploy-single.ps1** - Modular single-contract deployment
3. **verify-deployment.js** - Post-deployment verification
4. **config-manager.js** - Address extraction and management

### Contracts

**Core System (9 contracts):**

1. RoleManager
2. KYCRegistry
3. AssetRegistry
4. PropertyNFT
5. RWAToken
6. InvestmentManager
7. SecondaryMarket
8. RevenueDistributor

**Payment System (3 contracts):** 9. PriceOracle 10. PaymentEscrow 11. MultiTokenPayment

---

## Complete Deployment

### Usage

```powershell
# Deploy all contracts to localhost (Anvil)
.\script\deploy-all.ps1

# Deploy to Sepolia testnet
.\script\deploy-all.ps1 -Network sepolia

# Skip post-deployment verification
.\script\deploy-all.ps1 -SkipVerification
```

### Process Flow

1. **Environment Loading**
   - Loads `.env` from blockchain directory
   - Validates required environment variables
   - Sets process environment for dependency chain

2. **Prerequisites Validation**
   - Checks: `forge`, `cast`, `node`
   - Validates: `RPC_URL`, `DEPLOYER_PRIVATE_KEY`
   - For localhost: Checks/starts Anvil

3. **Network Detection**
   - Uses `cast chain-id` to detect network
   - Determines proper broadcast path

4. **Contract Deployment**
   - Deploys all 11 contracts in dependency order
   - Extracts proxy addresses from broadcast JSON
   - Updates process environment for dependency chain
   - Handles PaymentSystem (3-contract deployment)

5. **.env Update**
   - Updates existing entries
   - Appends new addresses
   - Preserves other environment variables

6. **Backend Sync**
   - Updates `backend/services/web3/addresses.json`
   - Organizes by chain ID
   - Maps environment keys to contract names

7. **Verification** (optional)
   - Runs `scripts/verify-deployment.js`
   - Validates deployment integrity
   - Reports any issues

### Output

```
========================================
  Complete Deployment System
========================================
Network: localhost

[1/6] Loading environment...
  ✓ Loaded environment variables

[2/6] Validating prerequisites...
  ✓ forge found
  ✓ cast found
  ✓ node found
  ✓ Anvil is running

[3/6] Detecting network...
  ✓ Chain ID: 31337

[4/6] Deploying contracts...

  [1/9] Deploying RoleManager...
    ✓ 0x5FbDB2315678afecb367f032d93F642f64180aa3
  ✓ RoleManager deployed successfully

  [2/9] Deploying KYCRegistry...
    ✓ 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  ✓ KYCRegistry deployed successfully

  ...

  [9/9] Deploying PaymentSystem...
    ✓ PriceOracle:        0x...
    ✓ PaymentEscrow:      0x...
    ✓ MultiTokenPayment:  0x...
  ✓ PaymentSystem deployed successfully

  ✓ All contracts deployed successfully!

[5/6] Updating .env file...
  ✓ Updated blockchain\.env

[6/6] Syncing addresses to backend...
  ✓ Synced to backend\services\web3\addresses.json

[7/7] Running post-deployment verification...
  ✓ All contracts verified

========================================
  Deployment Summary
========================================

Deployed Contracts:
  ROLEMANAGER_ADDRESS = 0x5FbDB2315678afecb367f032d93F642f64180aa3
  KYCREGISTRY_ADDRESS = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  ...

✓ Deployment completed successfully!
  Chain ID: 31337
  Addresses saved to: blockchain\.env
  Backend synced: backend\services\web3\addresses.json
```

---

## Single Contract Deployment

### Usage

```powershell
# Deploy single contract
.\script\deploy-single.ps1 -ContractName RoleManager

# Deploy with .env update
.\script\deploy-single.ps1 -ContractName PaymentSystem -UpdateEnv

# Deploy with full sync
.\script\deploy-single.ps1 -ContractName KYCRegistry -Network sepolia -UpdateEnv -SyncBackend
```

### Features

- **Dependency Validation**: Checks all required contract addresses exist
- **Automatic Loading**: Loads dependencies from .env
- **Flexible Output**: Optional .env and backend sync
- **PaymentSystem Support**: Handles 3-contract deployment

### Contract Names

Valid values for `-ContractName`:

- `RoleManager`
- `KYCRegistry`
- `AssetRegistry`
- `PropertyNFT`
- `RWAToken`
- `InvestmentManager`
- `SecondaryMarket`
- `RevenueDistributor`
- `PaymentSystem`

### Dependency Chain

```
RoleManager (no deps)
├── KYCRegistry
│   ├── AssetRegistry
│   │   ├── SecondaryMarket
│   │   └── RevenueDistributor
│   └── InvestmentManager
├── PropertyNFT
└── RWAToken
    ├── InvestmentManager
    ├── SecondaryMarket
    ├── RevenueDistributor
    └── PaymentSystem
        ├── PriceOracle
        ├── PaymentEscrow
        └── MultiTokenPayment
```

---

## Address Management

### blockchain/.env

Source of truth for contract addresses.

```env
# Network Configuration
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
DEPLOYER_PRIVATE_KEY=0x...
ADMIN_ADDRESS=0x...

# Core Contracts
ROLEMANAGER_ADDRESS=0x...
KYCREGISTRY_ADDRESS=0x...
ASSETREGISTRY_ADDRESS=0x...
PROPERTYNFT_ADDRESS=0x...
RWATOKEN_ADDRESS=0x...
INVESTMENTMANAGER_ADDRESS=0x...
SECONDARYMARKET_ADDRESS=0x...
REVENUEDISTRIBUTOR_ADDRESS=0x...

# Payment System
PRICE_ORACLE_ADDRESS=0x...
PAYMENT_ESCROW_ADDRESS=0x...
MULTI_TOKEN_PAYMENT_ADDRESS=0x...
```

### backend/services/web3/addresses.json

Backend API contract address storage, organized by chain ID.

```json
{
  "31337": {
    "RoleManager": "0x...",
    "KYCRegistry": "0x...",
    "AssetRegistry": "0x...",
    "PropertyNFT": "0x...",
    "RWAToken": "0x...",
    "InvestmentManager": "0x...",
    "SecondaryMarket": "0x...",
    "RevenueDistributor": "0x...",
    "PriceOracle": "0x...",
    "PaymentEscrow": "0x...",
    "MultiTokenPayment": "0x..."
  },
  "11155111": {
    ...
  }
}
```

### broadcast/

Foundry deployment records with full transaction details.

```
broadcast/
├── DeployRoleManager.s.sol/
│   ├── 31337/
│   │   └── run-latest.json
│   └── 11155111/
│       └── run-latest.json
├── DeployKYCRegistry.s.sol/
│   └── ...
└── ...
```

---

## Environment Variables

### Required

| Variable               | Description                 | Example                 |
| ---------------------- | --------------------------- | ----------------------- |
| `RPC_URL`              | Network RPC endpoint        | `http://127.0.0.1:8545` |
| `DEPLOYER_PRIVATE_KEY` | Deployer wallet private key | `0x...`                 |

### Required for Dependencies

| Variable                     | Required By                                                           | Role                       |
| ---------------------------- | --------------------------------------------------------------------- | -------------------------- |
| `ROLE_MANAGER_ADDRESS`       | KYCRegistry, AssetRegistry                                            | Access control             |
| `KYC_REGISTRY_ADDRESS`       | AssetRegistry, InvestmentManager, SecondaryMarket                     | KYC validation             |
| `ASSET_REGISTRY_ADDRESS`     | PropertyNFT, SecondaryMarket, RevenueDistributor                      | Asset tracking             |
| `PROPERTY_NFT_ADDRESS`       | InvestmentManager                                                     | Property fractionalization |
| `RWA_TOKEN_ADDRESS`          | InvestmentManager, SecondaryMarket, RevenueDistributor, PaymentSystem | Token transfers            |
| `INVESTMENT_MANAGER_ADDRESS` | PaymentSystem                                                         | Investment tracking        |

### Generated After Deployment

All contracts listed above, plus:

- `PRICE_ORACLE_ADDRESS`
- `PAYMENT_ESCROW_ADDRESS`
- `MULTI_TOKEN_PAYMENT_ADDRESS`

---

## Network Support

### Localhost (Anvil)

```powershell
# Start Anvil
anvil

# Deploy (in new terminal)
.\script\deploy-all.ps1
```

**Configuration:**

- RPC: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Auto-start: Yes (if not running)

### Sepolia Testnet

```powershell
.\script\deploy-all.ps1 -Network sepolia
```

**Configuration:**

- RPC: From `.env` → `RPC_URL`
- Chain ID: `11155111`
- Requires: Funded deployer wallet

---

## Verification

### Post-Deployment Verification

```powershell
node scripts/verify-deployment.js --network=localhost
```

**Checks:**

- Contract bytecode exists on-chain
- Initialization parameters correct
- Role assignments valid
- Dependencies properly set
- Contract configurations correct

### Skip Verification

```powershell
.\script\deploy-all.ps1 -SkipVerification
```

---

## Troubleshooting

### Prerequisites Not Found

```
Error: forge not found. Please install Foundry
```

**Solution:**

```powershell
# Install Foundry
# Windows: Use WSL or download binary
# See: https://book.getfoundry.sh/getting-started/installation
```

### Missing Environment Variables

```
Error: Required environment variable RPC_URL not set in .env
```

**Solution:**

- Check `blockchain/.env` exists
- Verify all required variables set
- Ensure no quotes around values

### Anvil Not Running

```
Warning: Anvil not running. Starting Anvil...
```

**Automatic:** Script starts Anvil automatically for localhost

**Manual:**

```powershell
anvil
```

### Deployment Failed

```
Error: Forge script failed with exit code 1
```

**Debug Steps:**

1. Check RPC_URL is accessible
2. Verify deployer has sufficient balance
3. Check dependency addresses exist
4. Review forge script output for details

### Broadcast File Not Found

```
Error: Broadcast file not found: broadcast/DeployXXX.s.sol/31337/run-latest.json
```

**Solution:**

- Verify forge script ran successfully
- Check `--broadcast` flag used
- Ensure correct network/chain ID

### Backend Sync Failed

```
Warning: Failed to sync to backend
```

**Non-Critical:** Deployment succeeded, manual sync needed

**Fix:**

```powershell
# Manual sync
node scripts/config-manager.js
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Deploy Contracts
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Foundry
        uses: foundry-rs/foundry-toolchain@v1

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Configure Environment
        run: |
          echo "RPC_URL=${{ secrets.RPC_URL }}" >> blockchain/.env
          echo "DEPLOYER_PRIVATE_KEY=${{ secrets.DEPLOYER_PRIVATE_KEY }}" >> blockchain/.env

      - name: Deploy Contracts
        run: .\blockchain\script\deploy-all.ps1 -Network sepolia

      - name: Upload Addresses
        uses: actions/upload-artifact@v3
        with:
          name: contract-addresses
          path: |
            blockchain/.env
            backend/services/web3/addresses.json
```

---

## Security Best Practices

1. **Private Keys**
   - Never commit `.env` to version control
   - Use CI/CD secrets for automated deployments
   - Rotate keys regularly

2. **RPC URLs**
   - Use dedicated RPC providers for production
   - Rate limit public RPC usage
   - Monitor for anomalies

3. **Admin Addresses**
   - Use hardware wallets for admin keys
   - Implement multi-sig for production
   - Separate deployer and admin roles

4. **Verification**
   - Always verify deployments
   - Test on testnet before mainnet
   - Document all deployment transactions

---

## File Structure

```
blockchain/
├── script/
│   ├── deploy-all.ps1          # Complete deployment orchestration
│   ├── deploy-single.ps1       # Single contract deployment
│   ├── DeployRoleManager.s.sol # Solidity deployment script
│   ├── DeployKYCRegistry.s.sol
│   ├── ...
│   └── DeployPaymentSystem.s.sol
├── scripts/
│   ├── verify-deployment.js    # Post-deployment verification
│   └── config-manager.js       # Address management utility
├── broadcast/                  # Foundry deployment records
│   └── Deploy*/*.json
├── .env                        # Environment configuration
└── foundry.toml               # Foundry configuration
```

---

## Changelog

### v1.0.0 (Current)

**New:**

- Complete PowerShell deployment system
- Modular single-contract deployment
- Automatic backend synchronization
- PaymentSystem (3-contract) support
- Network auto-detection
- Dependency validation
- Comprehensive error handling

**Changed:**

- Replaced bash scripts with PowerShell
- Fixed backend sync path (server → backend)
- Proper path handling with $PSScriptRoot
- Progress indicators and colored output

**Removed:**

- DeployContract.sh (obsolete bash script)
- deploy-all.sh (replaced by deploy-all.ps1)
- Hardcoded paths and addresses

**Fixed:**

- Missing PaymentSystem deployment
- Wrong backend sync directory
- Environment variable loading
- Address extraction from broadcast JSON
- Dependency chain resolution

---

## Future Enhancements

- [ ] Multi-network batch deployment
- [ ] Deployment rollback mechanism
- [ ] Gas estimation and optimization
- [ ] Contract verification on Etherscan
- [ ] Upgrade script for UUPS proxies
- [ ] Deployment cost reporting
- [ ] Address book export (CSV/Excel)
- [ ] Deployment templates
- [ ] Auto-generate frontend ABI files
- [ ] Integration with Tenderly for debugging

---

## Support

For issues or questions:

1. Check troubleshooting section
2. Review error messages carefully
3. Verify prerequisites installed
4. Check environment configuration
5. Review Foundry/PowerShell documentation

---

**Last Updated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
