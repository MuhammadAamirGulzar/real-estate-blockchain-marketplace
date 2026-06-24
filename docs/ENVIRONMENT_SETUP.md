# Environment Setup Guide

This guide walks you through setting up the complete environment for the EstateChain Marketplace multi-currency payment system.

## Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org/download/))
- **Foundry** (Solidity toolkit) - Install: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- **MetaMask** browser extension ([Install](https://metamask.io/))
- **Git** for version control

## Quick Start (3 Steps)

### 1. Clone & Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd EstateChain Marketplace

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Install blockchain dependencies
cd ../blockchain
forge install
```

### 2. Configure Environment Files

Each directory needs a `.env` file. Copy the templates:

```bash
# Backend
cd backend
cp .env.example .env

# Frontend
cd ../frontend
cp .env.example .env

# Blockchain
cd ../blockchain
cp .env.example .env
```

### 3. Set Up Database

```bash
# Create PostgreSQL database
psql -U postgres
CREATE DATABASE estatechain-marketplace_db;
\q

# Update backend/.env with your database URL
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/estatechain-marketplace_db"

# Run migrations
cd backend
npm run migrate
```

---

## Detailed Configuration

### Backend Configuration (`backend/.env`)

#### Required Variables

1. **Database**

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/estatechain-marketplace_db"
   ```

2. **JWT Secret** (Generate with: `openssl rand -base64 32`)

   ```env
   JWT_SECRET="your-secure-random-secret-here"
   JWT_EXPIRY="7d"
   ```

3. **Blockchain RPC**

   ```env
   # For local testing
   RPC_URL="http://127.0.0.1:8545"

   # For Sepolia testnet
   RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
   ```

   Get Infura key: [https://infura.io/](https://infura.io/) → Create project → Copy Project ID

4. **IPFS (Pinata)** - Required for payment proof uploads

   ```env
   PINATA_API_KEY="your-api-key"
   PINATA_SECRET="your-api-secret"
   PINATA_JWT_TOKEN="your-jwt-token"
   PINATA_GATEWAY="https://gateway.pinata.cloud/ipfs/"
   ```

   Setup:
   - Sign up at [https://pinata.cloud/](https://pinata.cloud/)
   - Go to **API Keys** → **New Key** → Select **Admin** permissions
   - Copy API Key, API Secret, and JWT Token

5. **Oracle API Keys** (For price feeds)

   **CoinGecko** (Crypto prices):

   ```env
   COINGECKO_API_KEY="your-coingecko-api-key"
   ```

   - Sign up at [https://www.coingecko.com/api](https://www.coingecko.com/api)
   - Free tier: 10-50 calls/min

   **Exchange Rate API** (Fiat rates):

   ```env
   EXCHANGE_RATE_API_KEY="your-exchange-rate-api-key"
   ```

   - Sign up at [https://www.exchangerate-api.com/](https://www.exchangerate-api.com/)
   - Free tier: 1,500 requests/month

#### Optional Variables

6. **Stripe** (Bank verification - optional)

   ```env
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_ENABLED=false
   ```

   - Get keys: [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)
   - Only enable if using automated bank verification

7. **Plaid** (US bank linking - optional)

   ```env
   PLAID_CLIENT_ID="your-client-id"
   PLAID_SECRET="your-sandbox-secret"
   PLAID_ENV="sandbox"
   PLAID_ENABLED=false
   ```

   - Sign up: [https://dashboard.plaid.com/signup](https://dashboard.plaid.com/signup)
   - Use "sandbox" for testing

8. **Email** (Payment notifications - optional)
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="your-app-password"
   EMAIL_FROM="noreply@estatechain-marketplace.com"
   ```

   - Gmail: Enable 2FA → Generate App Password
   - Other SMTP: Use your provider's settings

---

### Frontend Configuration (`frontend/.env`)

#### Required Variables

1. **API Connection**

   ```env
   VITE_API_URL="http://localhost:3001/api"
   VITE_WS_URL="ws://localhost:3001"
   ```

2. **Blockchain Configuration**

   ```env
   VITE_CHAIN_ID="11155111"  # Sepolia
   VITE_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
   VITE_BLOCKCHAIN_EXPLORER="https://sepolia.etherscan.io"
   ```

3. **WalletConnect** (For mobile wallet support)
   ```env
   VITE_WALLETCONNECT_PROJECT_ID="your-project-id"
   ```

   - Get ID: [https://cloud.walletconnect.com/](https://cloud.walletconnect.com/)
   - Click **Create** → Copy Project ID

#### Contract Addresses (Set After Deployment)

After deploying smart contracts (see Blockchain section), update:

```env
VITE_PRICE_ORACLE_ADDRESS="0x..."
VITE_PAYMENT_ESCROW_ADDRESS="0x..."
VITE_MULTI_TOKEN_PAYMENT_ADDRESS="0x..."
VITE_USDC_TOKEN_ADDRESS="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"  # Sepolia
VITE_USDT_TOKEN_ADDRESS="0xdA5289fCAAF71d52a80A254da614a192b693e977"  # Sepolia
```

---

### Blockchain Configuration (`blockchain/.env`)

#### Required Variables

1. **Deployer Private Key** (NEVER use this key for real funds!)

   ```env
   DEPLOYER_PRIVATE_KEY="0x..."
   ```

   Generate test key:

   ```bash
   cast wallet new
   # Save the private key (starts with 0x)
   ```

   **⚠️ SECURITY WARNING**: For production, use hardware wallet or secure key management

2. **RPC URL**

   ```env
   ETH_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
   CHAIN_ID="11155111"
   ```

3. **Etherscan API** (For contract verification)
   ```env
   ETHERSCAN_API_KEY="your-etherscan-api-key"
   ```

   - Get key: [https://etherscan.io/myapikey](https://etherscan.io/myapikey) → **Register** → Create API Key

#### Chainlink Oracle Feeds (Sepolia - Pre-configured)

These are already set in `.env.example` for Sepolia testnet:

```env
CHAINLINK_ETH_USD_FEED="0x694AA1769357215DE4FAC081bf1f309aDC325306"
CHAINLINK_USDC_USD_FEED="0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E"
```

For other networks, find feeds at: [https://docs.chain.link/data-feeds/price-feeds/addresses](https://docs.chain.link/data-feeds/price-feeds/addresses)

---

## Deploying Smart Contracts

### 1. Get Testnet ETH

Sepolia faucets:

- [https://sepoliafaucet.com/](https://sepoliafaucet.com/)
- [https://www.alchemy.com/faucets/ethereum-sepolia](https://www.alchemy.com/faucets/ethereum-sepolia)

Send 0.5-1 ETH to your deployer address.

### 2. Deploy Contracts

```bash
cd blockchain

# Deploy all contracts
forge script script/DeployPaymentSystem.s.sol \
  --rpc-url sepolia \
  --broadcast \
  --verify

# Output will show deployed addresses:
# PriceOracle: 0xabc...123
# PaymentEscrow: 0xdef...456
# MultiTokenPayment: 0xghi...789
```

### 3. Update Environment Files

Copy deployed addresses to:

1. `backend/.env`:

   ```env
   PRICE_ORACLE_ADDRESS="0xabc...123"
   PAYMENT_ESCROW_ADDRESS="0xdef...456"
   MULTI_TOKEN_PAYMENT_ADDRESS="0xghi...789"
   ```

2. `frontend/.env`:
   ```env
   VITE_PRICE_ORACLE_ADDRESS="0xabc...123"
   VITE_PAYMENT_ESCROW_ADDRESS="0xdef...456"
   VITE_MULTI_TOKEN_PAYMENT_ADDRESS="0xghi...789"
   ```

---

## Starting the Application

### 1. Start Backend

```bash
cd backend
npm run dev
```

Expected output:

```
✓ Connected to PostgreSQL database
✓ Oracle service initialized (updating every 5 minutes)
✓ Server running on http://localhost:3001
```

### 2. Start Frontend

```bash
cd frontend
npm run dev
```

Visit: [http://localhost:5173](http://localhost:5173)

---

## Testing the Setup

### Backend Health Check

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Check Exchange Rates

```bash
curl http://localhost:3001/api/oracle/currency-rate/USD/PKR
# Expected: {"from":"USD","to":"PKR","rate":277.89,"lastUpdate":"..."}
```

### Check Smart Contracts

Visit Sepolia Etherscan with your deployed addresses:

```
https://sepolia.etherscan.io/address/{PRICE_ORACLE_ADDRESS}
```

---

## Common Issues

### Database Connection Error

**Error**: `ECONNREFUSED 127.0.0.1:5432`

**Solution**:

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list  # Mac

# Start if stopped
sudo systemctl start postgresql  # Linux
brew services start postgresql  # Mac
```

### RPC Connection Error

**Error**: `could not detect network`

**Solution**:

- Check `RPC_URL` in `.env` files
- Verify Infura API key is valid
- Test RPC manually:
  ```bash
  curl https://sepolia.infura.io/v3/YOUR_KEY \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
  ```

### IPFS Upload Failing

**Error**: `Pinata authentication failed`

**Solution**:

- Verify `PINATA_JWT_TOKEN` in `backend/.env`
- Test Pinata API:
  ```bash
  curl https://api.pinata.cloud/data/testAuthentication \
    -H "Authorization: Bearer YOUR_JWT_TOKEN"
  ```

### MetaMask Not Connecting

**Solution**:

1. Add Sepolia network to MetaMask:
   - Network Name: `Sepolia Testnet`
   - RPC URL: `https://sepolia.infura.io/v3/YOUR_KEY`
   - Chain ID: `11155111`
   - Currency: `ETH`
   - Explorer: `https://sepolia.etherscan.io`

2. Get testnet ETH from faucets (see Deploying Contracts section)

---

## Security Best Practices

### 🔒 NEVER Commit These Files

Add to `.gitignore`:

```
backend/.env
frontend/.env
blockchain/.env
*.pem
*.key
```

Verify:

```bash
git status  # Should NOT show .env files
```

### 🔒 Use Different Keys for Dev/Production

- **Development**: Use test private keys, free API keys
- **Production**: Use hardware wallets, paid API tiers, monitoring

### 🔒 Rotate Secrets Regularly

- JWT secrets: Every 90 days
- API keys: Monitor usage, rotate if suspicious activity
- Private keys: Use multi-sig wallets for production

---

## Next Steps

1. ✅ Environment configured
2. ✅ Contracts deployed
3. ✅ Servers running

Now you can:

- Test payment flows (see [docs/FRONTEND_PAYMENT_COMPONENTS.md](./FRONTEND_PAYMENT_COMPONENTS.md))
- Set up admin accounts (run `backend/scripts/ensure-admin.js`)
- Configure properties for investment
- Test crypto and fiat payment methods

---

## Support Resources

- **Chainlink Docs**: [https://docs.chain.link/](https://docs.chain.link/)
- **Foundry Book**: [https://book.getfoundry.sh/](https://book.getfoundry.sh/)
- **Wagmi Docs**: [https://wagmi.sh/](https://wagmi.sh/)
- **shadcn/ui**: [https://ui.shadcn.com/](https://ui.shadcn.com/)

---

## Production Checklist

Before deploying to mainnet:

- [ ] Audit smart contracts (professional audit recommended)
- [ ] Test on testnet for 2+ weeks
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Configure database backups (daily)
- [ ] Enable rate limiting in production
- [ ] Use environment-specific API keys (prod keys)
- [ ] Set up SSL certificates (Let's Encrypt)
- [ ] Configure CORS for production domains only
- [ ] Enable `NODE_ENV=production`
- [ ] Review gas limits and prices for mainnet
- [ ] Set up multi-sig admin wallets
- [ ] Prepare incident response plan

---

_Last updated: Phase 6-7 completion_
