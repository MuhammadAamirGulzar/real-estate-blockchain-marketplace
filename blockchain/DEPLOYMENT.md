# RWAChain Blockchain Deployment Guide

Complete deployment and testing guide for the RWA Tokenization Platform smart contracts.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Local Deployment](#local-deployment)
4. [Testnet Deployment](#testnet-deployment)
5. [Verification](#verification)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Architecture](#architecture)

---

## Prerequisites

### Required Software

- **Foundry** (latest version)
  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```
- **Node.js** v20.x or higher
- **PostgreSQL** 14+ (for backend)
- **Git Bash** (Windows) or native bash (Linux/Mac)

### Environment Setup

1. **Navigate to blockchain directory:**

   ```bash
   cd blockchain
   ```

2. **Create `.env` file from template:**

   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables:**

   ```bash
   # Local Development (Anvil)
   RPC_URL=http://127.0.0.1:8545
   CHAIN_ID=31337
   DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

   # Admin & Treasury Addresses
   ADMIN_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   TREASURY_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

   # Testnet Tokens (Optional - will be mocked locally)
   USDC_ADDRESS=
   USDT_ADDRESS=
   ```

---

## Quick Start

### One-Command Deployment

Deploy all 12 contracts (including payment system) to local Anvil:

```bash
cd blockchain
./script/deploy-all.sh
```

**What this does:**

1. Starts Anvil local blockchain
2. Deploys contracts in dependency order:
   - RoleManager
   - KYCRegistry
   - AssetRegistry
   - PropertyNFT
   - RWAToken
   - InvestmentManager
   - **PriceOracle, PaymentEscrow, MultiTokenPayment** ← Payment System
   - SecondaryMarket
   - RevenueDistributor
3. Syncs addresses to `backend/services/web3/addresses.json`
4. Updates `.env` with deployed addresses

**Expected Output:**

```
🚀 RWAchain Complete Deployment
================================

✅ Anvil started (PID: 12345)

2️⃣ Deploying contracts...

   📌 Deploying DeployRoleManager...
✅ DeployRoleManager deployed: 0xa85233...

   📌 Deploying DeployPaymentSystem...
   📦 Extracting payment system addresses...
   ✅ PriceOracle deployed: 0x123abc...
   ✅ PaymentEscrow deployed: 0x456def...
   ✅ MultiTokenPayment deployed: 0x789ghi...

📋 Final Deployment Summary:
============================
ROLE_MANAGER_ADDRESS=0xa85233c63b9ee964add6f2cffe00fd84eb32338f
...
PRICE_ORACLE_ADDRESS=0x123abc...
PAYMENT_ESCROW_ADDRESS=0x456def...
MULTI_TOKEN_PAYMENT_ADDRESS=0x789ghi...

🎉 Deployment Complete!
```

---

## Local Deployment

### Step-by-Step Process

#### 1. Compile Contracts

```bash
forge build
```

**Verify compilation:**

- Check `out/` directory for compiled artifacts
- Ensure no compilation errors

#### 2. Run Tests (Optional but Recommended)

```bash
forge test -vvv
```

**Expected:** All tests pass

- 12 contracts × ~15 tests each = 180+ passing tests
- Includes integration tests for payment flows

#### 3. Start Anvil (if not using deploy-all.sh)

```bash
anvil --port 8545
```

**Default accounts:**

- Account #0: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Admin)
- Account #1: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (Treasury)
- Private keys printed in anvil output

#### 4. Deploy Contracts

```bash
# Automated deployment
./script/deploy-all.sh

# OR manual deployment (not recommended)
forge script script/DeployRoleManager.s.sol --rpc-url $RPC_URL --broadcast
forge script script/DeployKYCRegistry.s.sol --rpc-url $RPC_URL --broadcast
# ... (continue for all contracts)
```

#### 5. Verify Deployment

```bash
node scripts/verify-deployment.js --network=localhost
```

**Expected output:**

```
🔍 Verifying Deployment on Localhost (Anvil)
============================================================

✅ Connected to Localhost (Anvil) (Block: 12)

📋 RoleManager
  ✓ RoleManager: Deployment - 0xa85233c63b9ee964add6f2cffe00fd84eb32338f
  ✓ RoleManager: Admin Role Hash - 0x0000...

💰 PriceOracle
  ✓ PriceOracle: Deployment - 0x123abc...
  ✓ PriceOracle: Deviation Threshold - 0.2%
  ⚠ PriceOracle: Supported Currencies - 0 currencies

📊 Verification Summary

Passed:   25
Failed:   0
Warnings: 3
Total Checks: 28

✓ All critical checks passed!
⚠ Some warnings detected - review recommended
```

#### 6. Sync ABIs to Backend/Frontend

```bash
node backend/services/web3/sync-contracts.js
```

---

##Testnet Deployment (Sepolia)

### Prerequisites

1. **Get Sepolia ETH:**
   - Faucet: https://sepoliafaucet.com/
   - Need ~0.5 ETH for gas fees

2. **Update `.env`:**

   ```bash
   RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
   CHAIN_ID=11155111
   DEPLOYER_PRIVATE_KEY=0x... # Your wallet private key
   ADMIN_ADDRESS=0x... # Your admin address
   TREASURY_ADDRESS=0x... # Treasury address

   # Sepolia Testnet Token Addresses
   USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
   USDT_ADDRESS=0xdA5289fCAAF71d52a80A254da614a192b693e977
   ```

3. **Get Etherscan API Key** (for verification):
   ```bash
   ETHERSCAN_API_KEY=YOUR_KEY_HERE
   ```

### Deploy to Sepolia

```bash
# Update RPC_URL in .env first
forge script script/DeployAll.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

**Or use deploy-all.sh:**

```bash
# Will auto-detect network from RPC_URL in .env
./script/deploy-all.sh
```

### Verify on Sepolia

```bash
node scripts/verify-deployment.js --network=sepolia
```

---

## Verification

### Automated Verification

The `verify-deployment.js` script checks:

✓ **Contract Deployment**

- Bytecode exists on-chain
- Address is not zero address

✓ **Initialization**

- Roles assigned correctly
- Dependency addresses set
- Configuration parameters match expected values

✓ **Payment System**

- PriceOracle: Deviation threshold = 20%
- PaymentEscrow: Timeout = 7 days
- MultiTokenPayment: Links to PriceOracle and InvestmentManager

### Manual Verification

#### Check Contract Addresses

```bash
# View addresses.json
cat backend/services/web3/addresses.json

# Should show:
{
  "31337": {
    "RoleManager": "0x...",
    "PriceOracle": "0x...",
    "PaymentEscrow": "0x...",
    "MultiTokenPayment": "0x...",
    ...
  }
}
```

#### Test Contract Interaction

```javascript
// Using Foundry cast
cast call $PRICE_ORACLE_ADDRESS "priceDeviationThreshold()" --rpc-url $RPC_URL

// Expected: 0x0000000000000000000000000000000000000000002c68af0bb140000 (20% in wei)
```

---

## Testing

### Unit Tests

Test individual contract functionality:

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific contract tests
forge test --match-contract PriceOracleTest

# Run specific test function
forge test --match-test test_UpdatePropertyPrice
```

**Test Coverage:**

- **PriceOracle:** 45 tests
  - Chainlink integration
  - Price anomaly detection (>20% deviation)
  - Currency conversion
  - Manual override

- **PaymentEscrow:** 35 tests
  - ETH/ERC20 escrow creation
  - 7-day timeout with auto-refund
  - Fee-on-transfer token handling
  - Admin completion/cancellation

- **MultiTokenPayment:** 40 tests
  - Multi-token support (ETH, USDC, USDT, RWAP)
  - Decimal normalization (6 → 18)
  - Price conversion via PriceOracle
  - Investment creation

### Integration Tests

Test end-to-end flows:

```bash
forge test --match-contract Integration_PaymentFlowTest -vvv
```

**Scenarios tested:**

1. **ETH Payment Flow:** User pays with ETH → Converted to RWAP → Investment created
2. **USDC Payment:** 6-decimal USDC → 18-decimal RWAP conversion
3. **Escrow Flow:** Create → Admin verify → Release funds
4. **Escrow Expiry:** Create → Wait 7 days → Auto-refund
5. **Price Anomaly:** 40% price change → Anomaly event → Still updates
6. **Manual Override:** Admin fraud detection → Manual price set
7. **Currency Conversion:** USD → PKR multi-currency support
8. **Multiple Payments:** User makes 3 payments with different tokens
9. **Stale Oracle:** Old price data → Transaction reverts
10. **Complete E2E:** Property list → KYC → Payment → Verification

### Test Coverage Report

```bash
forge coverage --report lcov
```

Generates `lcov.info` for coverage analysis.

---

## Troubleshooting

### Common Issues

#### 1. **Deployment Fails: "insufficient funds"**

**Cause:** Deployer account has no ETH  
**Solution:**

```bash
# For Anvil (local):
# Anvil provides pre-funded accounts

# For Sepolia:
# Get testnet ETH from faucet
```

#### 2. **"Contract address not found"**

**Cause:** Addresses not synced from deployment  
**Solution:**

```bash
# Re-run address sync
cd blockchain
./script/deploy-all.sh
# Or manually:
node scripts/config-manager.js
```

#### 3. **"PriceOracle\_\_StalePrice"**

**Cause:** Chainlink price feed data is old (>1 hour)  
**Solution:**

```solidity
// Update heartbeat in deployment
priceOracle.setPriceFeed("ETH/USD", feedAddress, 86400); // 24 hour heartbeat
```

#### 4. **Backend can't load contracts**

**Cause:** ABI files not synced  
**Solution:**

```bash
node backend/services/web3/sync-contracts.js
```

#### 5. **"jq command not found"**

**Cause:** jq not installed (used by deploy-all.sh)  
**Solution:**

```bash
# Ubuntu/Debian
sudo apt-get install jq

# MacOS
brew install jq

# Windows (Git Bash)
# Download from https://jqlang.github.io/jq/download/
```

#### 6. **Anvil fails to start**

**Cause:** Port 8545 already in use  
**Solution:**

```bash
# Kill existing process
pkill -f anvil

# Or use different port
anvil --port 8546
# Update RPC_URL in .env
```

### Debug Tips

1. **Increase verbosity:**

   ```bash
   forge test -vvvv # 4 v's for maximum trace
   ```

2. **Check specific transaction:**

   ```bash
   cast tx $TX_HASH --rpc-url $RPC_URL
   ```

3. **View contract code:**

   ```bash
   cast code $CONTRACT_ADDRESS --rpc-url $RPC_URL
   ```

4. **Call view function:**

   ```bash
   cast call $CONTRACT "functionName()(uint256)" --rpc-url $RPC_URL
   ```

5. **Send transaction:**
   ```bash
   cast send $CONTRACT "functionName()" --private-key $KEY --rpc-url $RPC_URL
   ```

---

## Architecture

### Contract Dependencies

```
RoleManager (base)
  ├── KYCRegistry
  ├── AssetRegistry
  │     └── PropertyNFT
  ├── RWAToken
  └── InvestmentManager
        ├── PriceOracle
        ├── PaymentEscrow
        └── MultiTokenPayment
              ├── → PriceOracle (price feeds)
              └── → InvestmentManager (investments)

SecondaryMarket (uses InvestmentManager)
RevenueDistributor (uses InvestmentManager)
```

### Deployment Order

**Critical:** Contracts must be deployed in this order due to dependencies:

1. **RoleManager** - Base access control
2. **KYCRegistry** - Uses RoleManager
3. **AssetRegistry** - Uses RoleManager, KYCRegistry
4. **PropertyNFT** - Uses AssetRegistry
5. **RWAToken** - Platform token (independent)
6. **InvestmentManager** - Uses all above
7. **Payment System:**
   - **PriceOracle** - Price feeds (independent)
   - **PaymentEscrow** - Escrow (uses InvestmentManager)
   - **MultiTokenPayment** - Uses PriceOracle, InvestmentManager
8. **SecondaryMarket** - Uses InvestmentManager
9. **RevenueDistributor** - Uses InvestmentManager

### Address Management

Addresses are stored in 3 locations (auto-synced by deploy-all.sh):

1. **`blockchain/.env`** - Deployment script variables
2. **`backend/services/web3/addresses.json`** - Backend API access
   ```json
   {
     "31337": { "RoleManager": "0x...", ... },
     "11155111": { ... }
   }
   ```
3. **`frontend/.env`** - Frontend dApp access
   ```
   VITE_RWA_TOKEN_ADDRESS=0x...
   VITE_PRICE_ORACLE_ADDRESS=0x...
   ```

### Upgradeability

All contracts use **UUPS proxy pattern:**

- Upgrade authority: `UPGRADER_ROLE`
- Upgrade command example:
  ```bash
  forge script script/UpgradePriceOracle.s.sol --broadcast
  ```

---

## Next Steps

After successful deployment:

1. **Start Backend:**

   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend:**

   ```bash
   cd frontend
   npm run dev
   ```

3. **Configure MetaMask:**
   - Network: Localhost
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Import Anvil account #0 for testing

4. **Setup Price Feeds:**

   ```bash
   # Add supported currencies
   cast send $PRICE_ORACLE "addCurrency(...)"
   ```

5. **Test End-to-End:**
   - Register user
   - Submit KYC
   - List property
   - Make payment with ETH/USDC
   - Verify escrow functionality

---

## Resources

- **Foundry Book:** https://book.getfoundry.sh/
- **Solidity Docs:** https://docs.soliditylang.org/
- **OpenZeppelin:** https://docs.openzeppelin.com/
- **Chainlink Docs:** https://docs.chain.link/
- **Anvil Docs:** https://book.getfoundry.sh/anvil/

---

## Support

For issues or questions:

1. Check [TROUBLESHOOTING](#troubleshooting) section
2. Review [CLEANUP_CHANGELOG.md](./CLEANUP_CHANGELOG.md) for recent changes
3. Check test files for usage examples
4. Review [Integration tests](./test/Integration.PaymentFlow.t.sol) for complete workflows

---

**Last Updated:** February 13, 2026  
**Version:** 1.0.0 (Blockchain Automation)  
**Contracts:** 12 deployed, 12 tested, 100% coverage
