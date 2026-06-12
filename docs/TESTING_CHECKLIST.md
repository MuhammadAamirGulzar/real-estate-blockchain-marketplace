# Testing Readiness Checklist

## 📍 Current Status

✅ **All synchronization phases complete (1-9)**

- Configuration management system
- Transaction manager (atomic DB + blockchain)
- Web3 service integration
- KYC workflow sync (backend ↔ blockchain)
- Property listing sync
- Verifier assignment sync
- Role management sync
- Blockchain event listener (blockchain → backend)
- State reconciliation service (safety net)

⏸️ **Phase 10: Security hardening postponed** (focusing on testing first)

---

## 🎯 Testing Phase Objectives

1. ✅ Verify all features work end-to-end
2. ✅ Validate blockchain-backend synchronization
3. ✅ Test role-based permissions
4. ✅ Identify and fix bugs
5. ✅ Document any issues found
6. ✅ Ensure system ready for demo/presentation

---

## 📋 Pre-Testing Setup (Do Once)

### ☑️ 1. Environment Setup

**Terminal 1: Start Blockchain Node**

```bash
cd blockchain
anvil --block-time 2
```

Keep running. Note: First account is deployer.

**Deploy Contracts**

```bash
cd foundry
./script/deploy-all.sh local
```

**Verify:** Check `blockchain/deployments/addresses.json` exists

---

### ☑️ 2. Database Setup

```bash
cd backend
npm install
npx drizzle-kit push:pg
```

**Verify:**

```sql
psql $DATABASE_URL
\dt
-- Should show all tables
```

---

### ☑️ 3. Create Test Users

```bash
cd backend
node scripts/create-test-users.js
```

This creates:

- `admin@rwachain.com` / `Admin123!@#` (admin)
- `verifier@rwachain.com` / `Verifier123!@#` (verifier)
- `user1@rwachain.com` / `User123!@#` (approved KYC)
- `user2@rwachain.com` / `User123!@#` (pending KYC)
- `user3@rwachain.com` / `User123!@#` (no KYC)

**Grant blockchain roles:**

```bash
# Admin role
cast send $ROLE_MANAGER_ADDRESS "grantRoleByAdmin(bytes32,address)" \
  $(cast keccak "ADMIN_ROLE") \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --private-key $DEPLOYER_PRIVATE_KEY

# Verifier role
cast send $ROLE_MANAGER_ADDRESS "grantRoleByAdmin(bytes32,address)" \
  $(cast keccak "VERIFIER_ROLE") \
  0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  --private-key $DEPLOYER_PRIVATE_KEY
```

---

### ☑️ 4. Verify Setup

```bash
cd backend
node scripts/verify-setup.js
```

Should show all green checkmarks.

---

## 🚀 Daily Testing Workflow

### Morning Startup (Every Day)

**1. Start Services (4 terminals)**

Terminal 1 - Blockchain:

```bash
cd blockchain
anvil --block-time 2
```

Terminal 2 - Backend:

```bash
cd backend
npm run dev
```

Terminal 3 - Frontend:

```bash
cd frontend
npm run dev
```

Terminal 4 - Event Listener (optional):

```bash
cd backend
# Create a simple script to start listener
node -e "import('./services/blockchainEventListener.js').then(m => { m.blockchainEventListener.initialize(); m.blockchainEventListener.startListening(); })"
```

**2. Quick Health Check**

Open browser console and run:

```javascript
// Backend health
fetch("http://localhost:3001/api/health")
  .then((r) => r.json())
  .then(console.log);

// Frontend loads
console.log("Frontend:", window.location.href);
```

---

## 🧪 Testing Workflows (Priority Order)

### Day 1: Core Authentication & KYC

**Morning:**

- [ ] Test user registration
- [ ] Test user login
- [ ] Test wallet connection
- [ ] Test admin login

**Afternoon:**

- [ ] Test KYC submission (user)
- [ ] Test KYC approval (admin)
- [ ] Verify blockchain sync (check `KYCRegistry.getKYCStatus()`)
- [ ] Test KYC rejection flow

**Success Criteria:**

- Users can register and login ✅
- Wallets connect successfully ✅
- KYC submissions reach blockchain ✅
- Admin can approve/reject ✅
- Database matches blockchain state ✅

---

### Day 2: Property Listing & Verification

**Morning:**

- [ ] Test property submission (KYC-approved user)
- [ ] Verify property listed on blockchain (`AssetRegistry.getProperty()`)
- [ ] Test verifier assignment (admin)
- [ ] Verify assignment on blockchain

**Afternoon:**

- [ ] Login as verifier
- [ ] Test property verification
- [ ] Test property rejection
- [ ] Verify blockchain state matches DB

**Success Criteria:**

- Properties listed successfully ✅
- Verifiers assigned correctly ✅
- Verification updates blockchain ✅
- All transaction hashes stored ✅

---

### Day 3: Tokenization & Roles

**Morning:**

- [ ] Test property approval (admin)
- [ ] Test property tokenization
- [ ] Verify NFT minted (`PropertyNFT.ownerOf()`)
- [ ] Verify fractional tokens created

**Afternoon:**

- [ ] Test creating sub-admin
- [ ] Test creating verifier
- [ ] Verify roles on blockchain (`RoleManager.hasRole()`)
- [ ] Test role-based permissions

**Success Criteria:**

- Properties tokenize successfully ✅
- NFTs minted on-chain ✅
- Fractional tokens deployed ✅
- Roles grant/revoke work ✅

---

### Day 4: Event Listener & Reconciliation

**Morning:**

- [ ] Stop backend
- [ ] Perform blockchain operations directly (via cast)
- [ ] Restart backend
- [ ] Verify event listener syncs missed events

**Afternoon:**

- [ ] Create intentional DB/blockchain mismatch
- [ ] Run reconciliation (detection mode)
- [ ] Verify mismatches detected
- [ ] Run reconciliation (auto-fix mode)
- [ ] Verify database corrected

**Success Criteria:**

- Event listener catches up after downtime ✅
- Reconciliation detects mismatches ✅
- Auto-fix corrects database ✅
- No duplicate event processing ✅

---

### Day 5: Integration & Edge Cases

**Morning:**

- [ ] Test full user journey (registration → tokenization)
- [ ] Test concurrent operations
- [ ] Test transaction failures (insufficient gas, etc.)
- [ ] Test permission enforcement

**Afternoon:**

- [ ] Test secondary market (if implemented)
- [ ] Test transaction history
- [ ] Test audit trail
- [ ] Document all bugs found

**Success Criteria:**

- Complete user journey works ✅
- No race conditions ✅
- Proper error handling ✅
- Permission model enforced ✅

---

## 🐛 Bug Tracking Template

When you find a bug, document it:

```markdown
### Bug #X: [Brief Description]

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**

1.
2.
3.

**Expected Behavior:**

**Actual Behavior:**

**Screenshots/Logs:**

**Environment:**

- Network: Anvil / Sepolia
- Browser: Chrome / Firefox
- Wallet: MetaMask version

**Fix Status:** 🔴 Open / 🟡 In Progress / 🟢 Fixed
```

---

## 📊 Testing Metrics

Track your progress:

```
Database Operations:
- Users created: ___
- KYC submissions: ___
- Properties listed: ___
- Properties tokenized: ___

Blockchain Transactions:
- Total transactions: ___
- Successful: ___
- Failed: ___
- Average gas used: ___

Synchronization:
- Events captured: ___
- Mismatches found: ___
- Mismatches fixed: ___

Issues Found:
- Critical bugs: ___
- High priority: ___
- Medium priority: ___
- Low priority: ___
```

---

## 🎯 Definition of "Testing Complete"

System is ready when:

1. ✅ All core workflows tested end-to-end
2. ✅ No critical or high-priority bugs remaining
3. ✅ Blockchain-DB sync verified in both directions
4. ✅ Role-based permissions enforced
5. ✅ Event listener handles all scenarios
6. ✅ Reconciliation service works correctly
7. ✅ Transaction history accurate
8. ✅ Error handling graceful
9. ✅ System stable for 24+ hours
10. ✅ All test users can complete their workflows

---

## 📚 Quick Reference

**Key Files:**

- Testing Plan: `docs/TESTING_PLAN.md`
- Quick Setup: `docs/QUICK_TESTING_SETUP.md`
- This Checklist: `docs/TESTING_CHECKLIST.md`

**Helper Scripts:**

- Create test users: `backend/scripts/create-test-users.js`
- Verify setup: `backend/scripts/verify-setup.js`

**Contract Addresses:**

- `blockchain/deployments/addresses.json`

**Important Endpoints:**

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`
- Blockchain: `http://127.0.0.1:8545`

**Test Accounts (Anvil):**

```
0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Deployer/Admin)
1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Verifier)
2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (User1)
3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906 (User2)
4: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 (User3)
```

---

## ✅ Current Session Checklist

Use this for each testing session:

```
[ ] Anvil running
[ ] Backend running
[ ] Frontend running
[ ] Event listener running (optional)
[ ] MetaMask connected to localhost:8545
[ ] Test users created
[ ] Contracts deployed
[ ] addresses.json exists
[ ] .env configured correctly
```

---

## 🆘 Emergency Reset

If things get completely broken:

```bash
# Reset blockchain
killall anvil
cd blockchain && anvil --block-time 2
# Re-deploy contracts
cd foundry && ./script/deploy-all.sh local

# Reset database
cd backend
npx drizzle-kit drop  # ⚠️ Deletes all data
npx drizzle-kit push:pg
node scripts/create-test-users.js

# Clear browser data
# MetaMask: Settings → Advanced → Reset Account

# Restart everything
```

---

**You're ready to start testing!** 🚀

Follow the 5-day plan above or jump to specific workflows in `TESTING_PLAN.md`.
