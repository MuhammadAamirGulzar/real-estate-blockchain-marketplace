# Quick Testing Setup Guide

## 🚀 Get Started with Testing in 5 Minutes

### Step 1: Start the Blockchain Node

**Option A: Local Anvil (Recommended for testing)**

```bash
cd blockchain
anvil --block-time 2
```

Keep this terminal open. Copy one of the private keys shown for testing.

**Option B: Use Sepolia Testnet**

- Ensure you have Sepolia testnet RPC URL
- Ensure you have testnet ETH in your wallet

---

### Step 2: Deploy Smart Contracts

```bash
cd foundry

# Deploy all contracts (choose your network)
# For Anvil (local):
./script/deploy-all.sh local

# For Sepolia:
./script/deploy-all.sh sepolia
```

**Verify:** Check that `blockchain/deployments/addresses.json` was created with all contract addresses.

---

### Step 3: Configure Environment

Ensure `.env` file in root directory has these variables:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/estatechain-marketplace

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Blockchain
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Contract Addresses (loaded automatically from addresses.json)

# Frontend
FRONTEND_URL=http://localhost:5173

# Backend
PORT=3001

# Event Listener (manual start for testing)
BLOCKCHAIN_EVENT_LISTENER_AUTO_START=false

# Reconciliation (manual start for testing)
STATE_RECONCILIATION_AUTO_START=false

# IPFS (optional - can use mock hashes for testing)
IPFS_API_URL=http://localhost:5001
```

---

### Step 4: Setup Database

```bash
cd backend

# Install dependencies if not already done
npm install

# Run database migrations
npx drizzle-kit push:pg
```

**Verify:** Check PostgreSQL that tables are created:

```sql
\dt
-- Should show: users, kyc_submissions, properties, verifier_assignments, blockchainTransactions, etc.
```

---

### Step 5: Create Admin User

Run this script to create an admin user with proper blockchain role:

```bash
cd backend
node scripts/create-admin.js
```

Or manually in PostgreSQL:

```sql
INSERT INTO users (email, password, name, role, walletAddress, kycStatus)
VALUES (
  'admin@estatechain-marketplace.com',
  '$2a$10$...',  -- bcrypt hash of 'Admin123!@#'
  'Admin User',
  'admin',
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',  -- First Anvil account
  'approved'
);
```

Then grant admin role on blockchain:

```bash
cd blockchain
cast send $ROLE_MANAGER_ADDRESS "grantRoleByAdmin(bytes32,address)" \
  $(cast keccak "ADMIN_ROLE") \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --private-key $DEPLOYER_PRIVATE_KEY
```

---

### Step 6: Start Backend Server

```bash
cd backend
npm run dev
```

**Expected output:**

```
✅ Connected to PostgreSQL
✅ Web3 service initialized
✅ All contracts loaded
🚀 Server running on port 3001
```

Keep this terminal open and watch for logs.

---

### Step 7: Start Frontend

```bash
cd frontend
npm install  # If not already done
npm run dev
```

**Expected output:**

```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

Open browser to `http://localhost:5173`

---

### Step 8: Start Event Listener (Optional but Recommended)

Open a new terminal:

```bash
cd backend
node -e "import('./services/blockchainEventListener.js').then(m => m.stateReconciliationService.startListening())"
```

Or add API endpoint and start via admin UI.

---

## ✅ Verification Checklist

Test each component individually:

### Database Connection

```bash
cd backend
npm run db:check
```

### Blockchain Connection

```bash
cast block-number --rpc-url http://127.0.0.1:8545
```

### Contract Addresses

```bash
cat blockchain/deployments/addresses.json
```

Should show addresses for all 9 contracts.

### Backend Health

```bash
curl http://localhost:3001/api/health
```

Should return: `{"status":"ok"}`

### Frontend Loading

Open `http://localhost:5173` - should show homepage without errors.

---

## 🧪 Run Your First Test

### Test 1: User Registration

1. Open `http://localhost:5173`
2. Click "Sign Up"
3. Fill form:
   - Email: `test1@example.com`
   - Password: `Test123!@#`
   - Name: `Test User 1`
4. Submit

**Check Backend Logs:**

```
✅ User created: test1@example.com
```

**Check Database:**

```sql
SELECT * FROM users WHERE email = 'test1@example.com';
```

---

### Test 2: Admin Login

1. Go to `http://localhost:5173/login`
2. Login:
   - Email: `admin@estatechain-marketplace.com`
   - Password: `Admin123!@#`
3. Should redirect to admin dashboard

**Check Backend Logs:**

```
✅ User logged in: admin@estatechain-marketplace.com
```

---

### Test 3: Connect Wallet

1. Ensure MetaMask installed
2. Import one of Anvil's test accounts
3. Click "Connect Wallet" in UI
4. Approve in MetaMask
5. Wallet address should display

**Check Database:**

```sql
SELECT walletAddress FROM users WHERE email = 'test1@example.com';
```

---

## 🐛 Troubleshooting Quick Fixes

### Backend won't start

```bash
# Check database connection
psql $DATABASE_URL

# Check RPC connection
cast block-number --rpc-url $RPC_URL

# Check if port 3001 is already in use
lsof -i :3001
kill -9 <PID>
```

### Frontend build errors

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Contracts not found

```bash
cd blockchain
./script/deploy-all.sh local
```

### Database schema mismatch

```bash
cd backend
npx drizzle-kit drop  # ⚠️ This deletes all data
npx drizzle-kit push:pg
```

### MetaMask transactions failing

- Ensure you're connected to correct network (Localhost 8545 or Sepolia)
- Ensure wallet has sufficient gas
- Reset account in MetaMask (Settings → Advanced → Reset Account)

---

## 📚 Next Steps

Once basic setup is verified:

1. Follow [TESTING_PLAN.md](./TESTING_PLAN.md) for comprehensive testing
2. Test each workflow end-to-end
3. Document any issues found
4. Fix issues and re-test

---

## 🆘 Need Help?

**Check logs in order:**

1. Browser Console (F12)
2. Frontend Terminal
3. Backend Terminal
4. Blockchain Node Terminal (Anvil)

**Common issues:**

- Wrong network in MetaMask
- Missing environment variables
- Contracts not deployed
- Database not migrated
- Port conflicts

**Debug mode:**

```bash
# Backend with verbose logging
DEBUG=* npm run dev

# Frontend with source maps
npm run dev -- --debug
```

---

You're now ready to start comprehensive testing! 🎉

Follow the [detailed testing plan](./TESTING_PLAN.md) to validate all features.
