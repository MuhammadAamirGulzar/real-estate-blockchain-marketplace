# RWA Tokenization Platform - Testing & Validation Plan

## Overview

Comprehensive testing plan to verify end-to-end functionality of the platform, focusing on blockchain-backend synchronization and role-based workflows.

---

## 🎯 Testing Priority

1. **Critical Path** - Core workflows must work perfectly
2. **Integration Points** - Backend ↔ Blockchain ↔ Database sync
3. **Role-Based Access** - Permissions and authority model
4. **UI Functionality** - User experience and error handling

---

## ✅ Pre-Testing Checklist

### Environment Setup

- [ ] PostgreSQL database running and accessible
- [ ] `.env` file configured with all required variables:
  ```env
  DATABASE_URL=postgresql://...
  JWT_SECRET=...
  RPC_URL=http://127.0.0.1:8545 (or Sepolia)
  DEPLOYER_PRIVATE_KEY=...
  FRONTEND_URL=http://localhost:5173
  PORT=3001
  BLOCKCHAIN_EVENT_LISTENER_AUTO_START=false (manual for testing)
  STATE_RECONCILIATION_AUTO_START=false (manual for testing)
  ```
- [ ] All smart contracts deployed to local Anvil or Sepolia testnet
- [ ] Contract addresses in `blockchain/deployments/addresses.json`
- [ ] Backend dependencies installed (`npm install` in `backend/`)
- [ ] Frontend dependencies installed (`npm install` in `frontend/`)
- [ ] Database migrations applied (Drizzle)

### Initial Data Setup

- [ ] Admin user created with wallet address
- [ ] Admin wallet has ADMIN_ROLE in RoleManager contract
- [ ] Test users created (at least 3: regular user, verifier, sub-admin)
- [ ] Sample IPFS hashes ready for testing (or mock IPFS service)

---

## 🧪 Testing Phases

### Phase 1: Authentication & User Management

#### Test 1.1: User Registration & Login

**Steps:**

1. Open frontend at `http://localhost:5173`
2. Click "Sign Up"
3. Register new user:
   - Email: `testuser1@example.com`
   - Password: `Test123!@#`
   - Name: `Test User 1`
4. Login with credentials
5. Check dashboard loads

**Expected:**

- ✅ User created in database (`users` table)
- ✅ JWT token received
- ✅ Redirected to dashboard
- ✅ User role defaults to `user`

**Verify in Database:**

```sql
SELECT id, email, role, walletAddress, kycStatus FROM users WHERE email = 'testuser1@example.com';
```

---

#### Test 1.2: Wallet Connection

**Steps:**

1. Login as `testuser1@example.com`
2. Click "Connect Wallet"
3. Connect MetaMask (or wallet)
4. Approve connection

**Expected:**

- ✅ Wallet address stored in database
- ✅ UI shows connected wallet address
- ✅ User can now perform blockchain actions

**Verify in Database:**

```sql
SELECT walletAddress FROM users WHERE email = 'testuser1@example.com';
```

**Verify on Blockchain:**

```javascript
// In console or via script
const hasUserRole = await roleManager.hasRole(
  ethers.id("USER_ROLE"),
  walletAddress,
);
console.log("Has USER_ROLE:", hasUserRole); // Should be false initially
```

---

### Phase 2: KYC Workflow (Critical Path)

#### Test 2.1: KYC Submission (User)

**Steps:**

1. Login as user with connected wallet
2. Navigate to "KYC Verification" page
3. Fill KYC form:
   - Full Name: `John Doe`
   - Date of Birth: `1990-01-01`
   - Address: `123 Main St, City, Country`
   - ID Type: `Passport`
   - ID Number: `ABC123456`
   - Upload document (or use mock hash)
4. Submit form

**Expected:**

- ✅ Entry created in `kyc_submissions` table with status `pending`
- ✅ `users.kycStatus` updated to `pending`
- ✅ Blockchain transaction sent to `KYCRegistry.submitKYC(documentHash)`
- ✅ Transaction hash stored in `kyc_submissions.transactionHash`
- ✅ UI shows "KYC submitted, pending review"

**Verify in Database:**

```sql
SELECT * FROM kyc_submissions WHERE userId = (SELECT id FROM users WHERE email = 'testuser1@example.com');
SELECT kycStatus FROM users WHERE email = 'testuser1@example.com'; -- Should be 'pending'
```

**Verify on Blockchain:**

```javascript
const kycStatus = await kycRegistry.getKYCStatus(walletAddress);
console.log("Blockchain KYC Status:", kycStatus); // Should be 1 (Pending)
```

---

#### Test 2.2: KYC Approval (Admin)

**Steps:**

1. Logout, login as admin
2. Navigate to "Admin Dashboard" → "KYC Review"
3. See pending KYC submission for `testuser1@example.com`
4. Review documents
5. Click "Approve KYC"

**Expected:**

- ✅ `kyc_submissions.status` updated to `approved`
- ✅ `kyc_submissions.reviewedBy` set to admin ID
- ✅ `users.kycStatus` updated to `approved`
- ✅ Blockchain transaction sent to `KYCRegistry.approveKYC(walletAddress)`
- ✅ Transaction hash stored in `kyc_submissions.approvalTransactionHash`
- ✅ `blockchainTransactions` table records the transaction
- ✅ UI shows success message

**Verify in Database:**

```sql
SELECT status, approvalTransactionHash FROM kyc_submissions
WHERE userId = (SELECT id FROM users WHERE email = 'testuser1@example.com');

SELECT * FROM blockchainTransactions WHERE entityType = 'kyc' ORDER BY createdAt DESC LIMIT 1;
```

**Verify on Blockchain:**

```javascript
const isApproved = await kycRegistry.isKYCApproved(walletAddress);
console.log("KYC Approved on Blockchain:", isApproved); // Should be true

const kycStatus = await kycRegistry.getKYCStatus(walletAddress);
console.log("KYC Status:", kycStatus); // Should be 2 (Approved)
```

---

#### Test 2.3: Event Listener Sync (KYC)

**Purpose:** Verify that blockchain events update database

**Steps:**

1. Approve KYC directly on blockchain (using Etherscan or Foundry script)
2. Wait 5 seconds
3. Check database

**Expected:**

- ✅ Event listener detects `KYCApproved` event
- ✅ Database automatically updated (even though backend didn't trigger it)
- ✅ Console logs show event processing

**Manual Blockchain Call:**

```bash
# Using cast (Foundry)
cast send $KYC_REGISTRY_ADDRESS "approveKYC(address)" $USER_WALLET_ADDRESS --private-key $ADMIN_PRIVATE_KEY
```

**Verify Event Listener:**

```bash
# Check backend console for:
📥 KYCApproved event received
✅ KYC approval synced for wallet: 0x123...
```

---

### Phase 3: Property Listing Workflow

#### Test 3.1: Property Submission (User)

**Steps:**

1. Login as KYC-approved user
2. Navigate to "List Property"
3. Fill property form:
   - Title: `Luxury Villa`
   - Description: `Beautiful beachfront villa`
   - Location: `Miami, FL`
   - Price: `1000000`
   - Total Tokens: `100000`
   - Upload images/documents
4. Submit

**Expected:**

- ✅ Property created in `properties` table with status `pending`
- ✅ Metadata uploaded to IPFS (or stored locally)
- ✅ Blockchain transaction sent to `AssetRegistry.listProperty(metadataHash, price, totalTokens)`
- ✅ `PropertyListed` event emitted with `propertyId`
- ✅ `properties.assetRegistryId` updated with on-chain ID
- ✅ Transaction hash stored

**Verify in Database:**

```sql
SELECT id, title, status, assetRegistryId, listTransactionHash FROM properties
WHERE title = 'Luxury Villa';
```

**Verify on Blockchain:**

```javascript
const propertyId = property.assetRegistryId; // From DB
const onChainProperty = await assetRegistry.getProperty(propertyId);
console.log("On-chain property:", onChainProperty);
// Should show: lister address, metadata hash, isVerified=false
```

---

#### Test 3.2: Verifier Assignment (Admin)

**Setup:** Create a verifier user first

**Steps:**

1. Login as admin
2. Navigate to "Admin" → "User Management"
3. Promote a user to Verifier role
4. Navigate to "Properties" → "Pending Properties"
5. Select "Luxury Villa"
6. Click "Assign Verifier"
7. Select verifier from dropdown
8. Confirm assignment

**Expected:**

- ✅ `properties.assignedVerifierId` updated
- ✅ Entry created in `verifier_assignments` table
- ✅ Blockchain transaction sent to `AssetRegistry.assignVerifier(propertyId, verifierAddress)`
- ✅ Transaction hash stored
- ✅ Email/notification sent to verifier

**Verify in Database:**

```sql
SELECT assignedVerifierId, assignmentTransactionHash FROM properties WHERE title = 'Luxury Villa';
SELECT * FROM verifier_assignments ORDER BY createdAt DESC LIMIT 1;
```

**Verify on Blockchain:**

```javascript
const propertyId = property.assetRegistryId;
const onChainProperty = await assetRegistry.getProperty(propertyId);
console.log("Assigned Verifier:", onChainProperty.verifier); // Should match verifier wallet
```

---

#### Test 3.3: Property Verification (Verifier)

**Steps:**

1. Login as verifier
2. Navigate to "Verifier Dashboard" → "Assigned Properties"
3. See "Luxury Villa" in assigned properties list
4. Click "Review"
5. Review documents and metadata
6. Click "Approve Property"
7. Add verification notes
8. Submit

**Expected:**

- ✅ `properties.status` updated to `verified`
- ✅ `properties.verifiedAt` timestamp set
- ✅ Blockchain transaction sent to `AssetRegistry.verifyProperty(propertyId)`
- ✅ Transaction hash stored in `properties.verificationTransactionHash`
- ✅ Property now ready for admin final approval

**Verify in Database:**

```sql
SELECT status, verifiedAt, verificationTransactionHash FROM properties WHERE title = 'Luxury Villa';
```

**Verify on Blockchain:**

```javascript
const onChainProperty = await assetRegistry.getProperty(propertyId);
console.log("Is Verified:", onChainProperty.isVerified); // Should be true
console.log("Verified By:", onChainProperty.verifier); // Should be verifier wallet
```

---

### Phase 4: Property Approval & Tokenization

#### Test 4.1: Admin Final Approval

**Steps:**

1. Login as admin
2. Navigate to "Admin" → "Properties" → "Verified Properties"
3. Select "Luxury Villa"
4. Click "Approve for Tokenization"
5. Review all details
6. Confirm approval

**Expected:**

- ✅ `properties.status` updated to `approved`
- ✅ `properties.approvedAt` timestamp set
- ✅ Approval transaction recorded
- ✅ Property ready for minting

**Verify in Database:**

```sql
SELECT status, approvedAt FROM properties WHERE title = 'Luxury Villa';
```

---

#### Test 4.2: Property Tokenization (NFT Minting)

**Steps:**

1. Still on admin property detail page
2. Click "Tokenize Property"
3. Confirm token details:
   - Token Name: `Luxury Villa Token`
   - Token Symbol: `LVILLA`
   - Total Supply: `100000`
4. Submit

**Expected:**

- ✅ `PropertyNFT.mintProperty()` called on blockchain
- ✅ NFT minted with metadata URI pointing to IPFS
- ✅ `PropertyMinted` event emitted with `nftTokenId`
- ✅ `properties.nftTokenId` updated
- ✅ `properties.status` updated to `tokenized`
- ✅ Fractional token contract deployed (ERC-20)
- ✅ `properties.fractionalTokenAddress` stored

**Verify in Database:**

```sql
SELECT status, nftTokenId, fractionalTokenAddress, tokenizationTransactionHash
FROM properties WHERE title = 'Luxury Villa';
```

**Verify on Blockchain:**

```javascript
// Check NFT
const nftExists = await propertyNFT.ownerOf(nftTokenId); // Should not revert
console.log("NFT Owner:", nftExists); // Should be contract or admin

// Check fractional token
const fractionalToken = await ethers.getContractAt(
  "FractionalPropertyToken",
  fractionalTokenAddress,
);
const totalSupply = await fractionalToken.totalSupply();
console.log("Total Supply:", totalSupply); // Should match expected supply
```

---

### Phase 5: Role Management & Permissions

#### Test 5.1: Create Sub-Admin

**Steps:**

1. Login as admin
2. Navigate to "Admin" → "User Management"
3. Select a user
4. Click "Promote to Sub-Admin"
5. Confirm

**Expected:**

- ✅ `users.role` updated to `admin`
- ✅ Blockchain transaction sent to `RoleManager.grantRoleByAdmin(SUB_ADMIN_ROLE, userWallet)`
- ✅ Transaction hash stored in `users.roleGrantTransactionHash`
- ✅ User now has admin privileges (limited scope)

**Verify in Database:**

```sql
SELECT role, roleGrantTransactionHash FROM users WHERE email = 'subadmin@example.com';
```

**Verify on Blockchain:**

```javascript
const hasSubAdminRole = await roleManager.hasRole(
  ethers.id("SUB_ADMIN_ROLE"),
  userWallet,
);
console.log("Has SUB_ADMIN_ROLE:", hasSubAdminRole); // Should be true
```

---

#### Test 5.2: Create Verifier

**Steps:**

1. Login as admin
2. Navigate to "Admin" → "Verifier Management"
3. Select user with approved KYC
4. Click "Grant Verifier Role"
5. Confirm

**Expected:**

- ✅ `users.role` updated to `verifier`
- ✅ Blockchain transaction sent to `RoleManager.grantRoleByAdmin(VERIFIER_ROLE, userWallet)`
- ✅ Transaction hash stored
- ✅ User can now verify properties

**Verify in Database:**

```sql
SELECT role, roleGrantTransactionHash FROM users WHERE email = 'verifier@example.com';
```

**Verify on Blockchain:**

```javascript
const hasVerifierRole = await roleManager.hasRole(
  ethers.id("VERIFIER_ROLE"),
  userWallet,
);
console.log("Has VERIFIER_ROLE:", hasVerifierRole); // Should be true
```

---

### Phase 6: State Reconciliation

#### Test 6.1: Manual Reconciliation (Detection Mode)

**Steps:**

1. Login as admin
2. Navigate to "Admin" → "Reconciliation Dashboard"
3. Click "Generate Report (No Fix)"
4. Wait for report generation

**Expected:**

- ✅ Backend queries blockchain for all users, properties, KYC statuses
- ✅ Compares DB state with blockchain state
- ✅ Report shows mismatches (if any)
- ✅ No database changes made

**Verify in Console:**

```bash
# Backend should log:
🔍 Reconciling KYC statuses...
🔍 Reconciling property statuses...
🔍 Reconciling user roles...
✅ Reconciliation complete
```

---

#### Test 6.2: Intentional Mismatch & Auto-Fix

**Setup:** Create a mismatch intentionally

**Steps:**

1. Approve KYC on blockchain directly (bypass backend):
   ```bash
   cast send $KYC_REGISTRY_ADDRESS "approveKYC(address)" $USER2_WALLET --private-key $ADMIN_KEY
   ```
2. Do NOT update database manually
3. In Reconciliation Dashboard, click "Run Full Reconciliation (Auto-Fix)"
4. Wait for completion

**Expected:**

- ✅ Reconciliation detects mismatch:
  - Blockchain: `approved`
  - Database: `pending`
- ✅ Auto-fix updates database to `approved`
- ✅ UI shows "1 mismatch fixed"

**Verify in Console:**

```bash
⚠️ KYC mismatch for user user2@example.com:
  - Blockchain: approved
  - DB: pending
  ✅ Fixed → approved
```

**Verify in Database:**

```sql
SELECT kycStatus FROM users WHERE email = 'user2@example.com'; -- Should now be 'approved'
```

---

### Phase 7: Secondary Market Trading

#### Test 7.1: List Tokens for Sale

**Steps:**

1. Login as user who owns fractional tokens
2. Navigate to "Portfolio"
3. Select tokenized property
4. Click "Sell Tokens"
5. Enter:
   - Amount: `1000` tokens
   - Price per token: `10` USD
6. Submit listing

**Expected:**

- ✅ Listing created in `secondary_market_listings` table
- ✅ Tokens locked or approval granted
- ✅ Listing appears on marketplace

**Verify in Database:**

```sql
SELECT * FROM secondary_market_listings WHERE sellerId = (SELECT id FROM users WHERE email = 'seller@example.com');
```

---

#### Test 7.2: Purchase Tokens

**Steps:**

1. Login as different user (buyer)
2. Navigate to "Marketplace"
3. Find listed property
4. Click "Buy Tokens"
5. Enter amount: `500` tokens
6. Confirm purchase

**Expected:**

- ✅ Token transfer executed on blockchain
- ✅ Payment processed
- ✅ Ownership updated in database
- ✅ Both users' portfolios updated

**Verify on Blockchain:**

```javascript
const sellerBalance = await fractionalToken.balanceOf(sellerAddress);
const buyerBalance = await fractionalToken.balanceOf(buyerAddress);
console.log("Seller Balance:", sellerBalance);
console.log("Buyer Balance:", buyerBalance);
```

---

## 🔍 Integration Testing Scenarios

### Scenario 1: Full User Journey

**Complete flow from registration to property ownership:**

1. User registers → ✅
2. User connects wallet → ✅
3. User submits KYC → ✅
4. Admin approves KYC → ✅
5. User lists property → ✅
6. Admin assigns verifier → ✅
7. Verifier verifies property → ✅
8. Admin approves for tokenization → ✅
9. Property tokenized → ✅
10. User receives tokens → ✅
11. User sells tokens on secondary market → ✅
12. Another user buys tokens → ✅

**Success Criteria:** Zero errors, all blockchain transactions confirmed, database consistent with blockchain

---

### Scenario 2: Event Listener Resilience

**Test blockchain → database synchronization:**

1. Stop backend server
2. Perform blockchain operations directly (via cast or Etherscan):
   - Approve KYC for User X
   - Verify Property Y
   - Grant role to User Z
3. Restart backend server
4. Start event listener
5. Wait 30 seconds

**Expected:**

- ✅ Event listener replays past events from last checkpoint
- ✅ Database updated with all missed events
- ✅ No duplicate processing

---

### Scenario 3: Permission Enforcement

**Test role-based access control:**

1. User (non-admin) tries to access admin endpoints → ❌ 403 Forbidden
2. User (non-verifier) tries to verify property → ❌ 403 Forbidden
3. Verifier tries to approve property (admin only) → ❌ 403 Forbidden
4. Each role can only perform authorized actions → ✅

**Verify in both:**

- Frontend (UI elements hidden/disabled)
- Backend (middleware blocks unauthorized requests)
- Blockchain (contract modifiers revert unauthorized calls)

---

## 📊 Success Metrics

### Database Consistency

```sql
-- All approved KYC should have transaction hashes
SELECT COUNT(*) FROM kyc_submissions WHERE status = 'approved' AND approvalTransactionHash IS NULL;
-- Should return 0

-- All tokenized properties should have NFT IDs
SELECT COUNT(*) FROM properties WHERE status = 'tokenized' AND nftTokenId IS NULL;
-- Should return 0

-- All blockchain transactions should have receipts
SELECT COUNT(*) FROM blockchainTransactions WHERE status = 'confirmed' AND receipt IS NULL;
-- Should return 0
```

### Blockchain Consistency

```javascript
// All users in DB with walletAddress should have USER_ROLE on blockchain
// (or higher role)

// All approved KYC users should be approved on blockchain

// All verified properties should be verified on blockchain

// All granted roles should exist on blockchain
```

---

## 🐛 Known Issues to Test

1. **Transaction Failures**
   - Test gas limit exceeded scenarios
   - Test insufficient balance scenarios
   - Verify rollback works correctly

2. **Network Issues**
   - Test RPC connection loss during transaction
   - Test event listener reconnection
   - Test transaction retry logic

3. **Concurrent Operations**
   - Multiple users submitting KYC simultaneously
   - Multiple properties being tokenized concurrently
   - Nonce conflicts and resolution

4. **Edge Cases**
   - User without wallet trying to perform blockchain action
   - Non-KYC-approved user listing property
   - Verifier approving property without assignment
   - Property tokenization before admin approval

---

## 📝 Test Execution Log

Use this checklist during testing:

```
Phase 1: Authentication & User Management
[ ] User Registration & Login
[ ] Wallet Connection

Phase 2: KYC Workflow
[ ] KYC Submission (User)
[ ] KYC Approval (Admin)
[ ] Event Listener Sync (KYC)

Phase 3: Property Listing Workflow
[ ] Property Submission (User)
[ ] Verifier Assignment (Admin)
[ ] Property Verification (Verifier)

Phase 4: Property Approval & Tokenization
[ ] Admin Final Approval
[ ] Property Tokenization (NFT Minting)

Phase 5: Role Management & Permissions
[ ] Create Sub-Admin
[ ] Create Verifier

Phase 6: State Reconciliation
[ ] Manual Reconciliation (Detection Mode)
[ ] Intentional Mismatch & Auto-Fix

Phase 7: Secondary Market Trading
[ ] List Tokens for Sale
[ ] Purchase Tokens

Integration Testing
[ ] Full User Journey
[ ] Event Listener Resilience
[ ] Permission Enforcement
```

---

## 🚀 Ready to Start Testing

**Next Steps:**

1. Ensure all services running (Database, Backend, Frontend, Blockchain node)
2. Create test users with different roles
3. Follow test scenarios in order
4. Document any bugs or issues found
5. Fix issues and re-test
6. Repeat until all tests pass

**Testing Environment:**

- Local Anvil/Hardhat node (recommended for iteration speed)
- OR Sepolia testnet (closer to production, slower)

**Tools Needed:**

- MetaMask or compatible wallet
- Cast (Foundry) for direct blockchain calls
- PostgreSQL client (psql, DBeaver, etc.)
- Browser DevTools
- Backend logs (console output)

---

## 📞 Troubleshooting

If tests fail:

1. Check backend console for errors
2. Check browser console for frontend errors
3. Verify contract addresses in `addresses.json`
4. Verify `.env` configuration
5. Check database connection
6. Verify RPC endpoint is responding
7. Check wallet has sufficient gas
8. Verify admin wallet has required roles on contracts

Ready to begin testing! 🎉
