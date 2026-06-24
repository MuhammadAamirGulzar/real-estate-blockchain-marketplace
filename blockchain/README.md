# EstateChain Marketplace Blockchain

Foundry-based Solidity smart contracts for the Real World Asset (RWA) tokenization platform.

## Quick Start

### Installation

```bash
# Install Foundry if not already installed
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install
```

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required variables:

- `ETH_RPC_URL` / `RPC_URL` - RPC endpoint for deployment
- `DEPLOYER_PRIVATE_KEY` / `PRIVATE_KEY` - Deployer account private key
- `CHAIN_ID` - Target chain ID
- `ETHERSCAN_API_KEY` - For contract verification (optional)

### Build

```bash
forge build
```

### Testing

```bash
# Run all tests
forge test

# Run with verbose output
forge test -vvv

# Run with gas report
forge test --gas-report

# Run specific test file
forge test --match-path src/test/RWAToken.t.sol
```

### Deployment

```bash
# Deploy all contracts (Bash)
bash script/deploy-all.sh

# Deploy all contracts (PowerShell - Windows)
powershell .\script\deploy-all.ps1
```

Individual contract deployment:

```bash
forge script script/DeployRWAToken.s.sol --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
```

### Project Structure

```
blockchain/
├── src/                        # Smart contracts
│   ├── RWAToken.sol           # ERC20 RWA token
│   ├── PropertyNFT.sol        # ERC721 property NFTs
│   ├── AssetRegistry.sol      # Asset registry
│   ├── InvestmentManager.sol  # Investment management
│   ├── KYCRegistry.sol        # KYC verification
│   ├── RevenueDistributor.sol # Revenue distribution
│   ├── RoleManager.sol        # Role-based access control
│   ├── SecondaryMarket.sol    # Secondary trading
│   └── FractionalPropertyToken.sol # Fractional tokens
├── test/                       # Solidity tests
│   ├── RWAToken.t.sol
│   ├── PropertyNFT.t.sol
│   ├── AssetRegistry.t.sol
│   ├── InvestmentManager.t.sol
│   ├── KYCRegistry.t.sol
│   ├── RevenueDistributor.t.sol
│   ├── RoleManager.t.sol
│   ├── SecondaryMarket.t.sol
│   └── FractionalPropertyToken.t.sol
├── script/                     # Deployment scripts
│   ├── Deploy*.s.sol           # Individual contract deployments
│   ├── Upgrade*.s.sol          # Contract upgrades
│   ├── deploy-all.sh           # Bash deployment script
│   ├── deploy-all.ps1          # PowerShell deployment script
│   └── CheckPropertyNFTAdmin.s.sol
├── lib/                        # Dependencies
│   ├── forge-std/              # Foundry standard library
│   ├── openzeppelin-contracts/ # OpenZeppelin libraries
│   └── openzeppelin-contracts-upgradeable/ # Upgradeable contracts
├── broadcast/                  # Deployment artifacts & transaction records
├── cache/                      # Build cache & test artifacts
├── out/                        # Compiled contract artifacts (ABI, bytecode)
├── docs/                       # Contract documentation
├── foundry.toml                # Foundry configuration
├── remappings.txt              # Solidity import remappings
├── package.json                # Node dependencies (Foundry CLI tools)
├── .env                        # Environment variables (local)
├── .env.example                # Environment template
└── README.md                   # This file
```

## Smart Contracts Overview

### Core Contracts

#### RWAToken.sol

- **Type**: ERC20
- **Purpose**: Main RWA platform token
- **Features**:
  - Upgradeable via proxy pattern
  - Burnable tokens
  - Pausable transfers

#### PropertyNFT.sol

- **Type**: ERC721
- **Purpose**: Represents property assets
- **Features**:
  - Upgradeable
  - Metadata URI support
  - Approval-based minting

#### AssetRegistry.sol

- **Type**: Core registry
- **Purpose**: Track all registered real-world assets
- **Features**:
  - Property registration
  - Asset metadata storage
  - Owner tracking

#### InvestmentManager.sol

- **Type**: Core contract
- **Purpose**: Manage user investments
- **Features**:
  - Investment creation
  - Allocation tracking
  - Dividend distribution

#### KYCRegistry.sol

- **Type**: Access control
- **Purpose**: KYC verification tracking
- **Features**:
  - User KYC status
  - Verification expiry
  - Admin approval flow

#### RevenueDistributor.sol

- **Type**: Core contract
- **Purpose**: Distribute property revenues
- **Features**:
  - Revenue pool management
  - Shareholder distributions
  - Claim tracking

#### RoleManager.sol

- **Type**: Access control
- **Purpose**: Role-based permissions
- **Roles**:
  - ADMIN - Full access
  - PROPERTY_MANAGER - Manage properties
  - VERIFIER - Approve KYC/documents
  - TREASURER - Financial management

#### SecondaryMarket.sol

- **Type**: Trading contract
- **Purpose**: P2P token trading
- **Features**:
  - Order placement
  - Trade execution
  - Escrow management

## Tests

Comprehensive test coverage for all contracts:

```bash
# Run all tests
forge test

# Run tests with coverage
forge coverage

# Run specific test
forge test --match-contract RWAToken

# Run specific test function
forge test --match-function testTransfer
```

## Deployment

### Local Development (Anvil)

```bash
# Start local blockchain
anvil

# In another terminal, deploy to local blockchain
forge script script/DeployRWAToken.s.sol --rpc-url http://127.0.0.1:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
```

### Testnet Deployment

Update `.env` with testnet RPC and deployer private key, then:

```bash
forge script script/deploy-all.sh --rpc-url $TESTNET_RPC_URL --broadcast --verify
```

### Post-Deployment

1. **Update Backend**: Copy contract addresses to backend `.env`
2. **Update Frontend**: Contract ABIs are synced automatically
3. **Verify Contracts**: Run verification script if on public chain

## Contract Architecture

```
RoleManager (Access Control)
    ↓
AssetRegistry (Asset Storage)
    ↓
PropertyNFT (Asset Representation)
    ↓
InvestmentManager (Investment Tracking)
    ↓
RevenueDistributor (Returns Distribution)
    ↓
SecondaryMarket (P2P Trading)
```

## Technologies

- **Language**: Solidity ^0.8.0
- **Testing**: Foundry (Forge)
- **Libraries**:
  - OpenZeppelin Contracts
  - OpenZeppelin Upgradeable Contracts
  - Foundry Standard Library

## Security

- All contracts audited patterns
- Uses OpenZeppelin battle-tested implementations
- Pausable mechanisms for emergency stops
- Multi-sig admin for critical functions
- Event logging for all state changes

### Contract Upgrade Strategy

Contracts use UUPS (Universal Upgradeable Proxy Standard):

```bash
# Upgrade contract
forge script script/UpgradeRWAToken.s.sol --rpc-url $RPC_URL --broadcast
```

## Integration

### Backend Integration

Backend interacts with contracts via ethers.js:

- See `backend/services/web3Service.js`
- Contract ABIs auto-synced to frontend

### Frontend Integration

Frontend reads contract state and sends transactions:

- Contract ABIs in `frontend/src/contracts/abi/`
- Integration via `frontend/src/lib/contracts.js`

## Development

### Formatting

```bash
forge fmt
```

### Gas Optimization

```bash
# Generate gas report
forge test --gas-report

# Check contract size
forge build --sizes
```

## Troubleshooting

### Compilation Errors

```bash
# Clear cache and rebuild
rm -rf cache out
forge build
```

### Test Failures

```bash
# Run with debug output
forge test -vvv --match-test <test_name>
```

### Deployment Issues

1. Check `.env` variables are set correctly
2. Verify account has sufficient balance
3. Check RPC endpoint is responsive
4. Ensure private key is correct

## Contributing

1. Create feature branch: `git checkout -b feature/contract-name`
2. Write tests before implementation
3. Run full test suite: `forge test`
4. Format code: `forge fmt`
5. Commit and push
6. Create PR with description

## Documentation

For detailed contract documentation:

- See `docs/` folder in this directory
- Review inline code comments
- Check test files for usage examples

## License

Part of EstateChain Marketplace.
Licensed under PolyForm Noncommercial License 1.0.0.
