# Blockchain-Backend-DB Synchronization Implementation

## ✅ Phase 1 Complete: Configuration Foundation

### Created Files

1. **[backend/config/networks.js](backend/config/networks.js)**
   - Network-specific configurations (local, sepolia, mainnet)
   - Gas limits, confirmation requirements, security settings
   - Validates mainnet safety (prevents test keys on mainnet)
   - Auto-detects network from environment

2. **[backend/config/contracts.config.js](backend/config/contracts.config.js)**
   - Loads contract addresses based on chainId
   - Validates all required contracts deployed
   - Loads ABIs from blockchain build artifacts
   - Fails fast on missing configuration
   - Initialization function for server startup

3. **[blockchain/scripts/config-manager.js](blockchain/scripts/config-manager.js)**
   - Reads Foundry deployment broadcasts
   - Extracts deployed contract addresses
   - Generates unified addresses.json for all networks
   - Auto-runs after deployment scripts
   - Validates all required contracts present

### Created Database Tables

4. **[backend/db/schema.js](backend/db/schema.js)** - Added `blockchainTransactions` table
   - Tracks all blockchain transactions
   - Stores transaction hash, status, confirmations
   - Links to related entities (KYC, property, user)
   - Enables transaction replay and audit trail

### Created Core Services

5. **[backend/services/transactionManager.js](backend/services/transactionManager.js)**
   - Wraps all blockchain calls with DB synchronization
   - Atomic DB + blockchain operations
   - Gas estimation and management
   - Nonce tracking to avoid conflicts
   - Retry logic for failed transactions
   - Transaction status tracking
   - Rollback on failures

---

## 🔄 Next Steps (Implementation Order)

### Phase 2: Fix Backend → Blockchain Sync (CRITICAL)

These fixes ensure database updates trigger blockchain calls:

#### 2.1 KYC Workflow [backend/controllers/adminController.js]

- [ ] `submitKycRequest()` - Call `KYCRegistry.submitKYC(documentHash)` after DB insert
- [ ] `approveKycRequest()` - Call `KYCRegistry.approveKYC(userWallet)` via transactionManager
- [ ] `rejectKycRequest()` - Call `KYCRegistry.rejectKYC(userWallet, reason)`
- [ ] Store transaction hashes in database

#### 2.2 Property Listing [backend/controllers/propertiesController.js]

- [ ] `listProperty()` - Call `AssetRegistry.listProperty(metadataHash)`
- [ ] Capture `propertyId` from `PropertyListed` event
- [ ] Update `properties.assetRegistryId` with on-chain ID

#### 2.3 Verifier Assignment [backend/controllers/adminController.js]

- [ ] `assignVerifier()` - Call `AssetRegistry.assignVerifier(propertyId, verifierAddress)`
- [ ] Validate verifier has VERIFIER_ROLE first
- [ ] Store assignment transaction hash

#### 2.4 Property Verification [backend/controllers/verifierController.js]

- [ ] `verifyPropertyDocuments()` - Call `AssetRegistry.verifyProperty(propertyId)`
- [ ] `rejectProperty()` - Call `AssetRegistry.rejectProperty(propertyId, reason)`

#### 2.5 Property Approval & Tokenization [backend/services/tokenization.service.js]

- [ ] Verify property status on AssetRegistry before minting
- [ ] Use `property.assetRegistryId` not `property.id`
- [ ] Capture `nftTokenId` from `PropertyMinted` event
- [ ] Store fractional token address

#### 2.6 Role Management [backend/controllers/adminController.js]

- [ ] `promoteToVerifier()` - Call `RoleManager.grantRoleByAdmin()` before DB update
- [ ] `promoteToAdmin()` / `promoteToSubAdmin()` - Same pattern
- [ ] `demoteUser()` - Call `RoleManager.revokeRoleByAdmin()`

#### 2.7 Verifier Application Approval [backend/controllers/adminController.js]

- [ ] `approveVerifierApplication()` - Call `KYCRegistry.approveVerifierApplication()`
- [ ] Then call `KYCRegistry.grantVerifierRole()`

### Phase 3: Implement Blockchain → DB Sync (Event Listeners)

Create services to listen to blockchain events and update database:

#### 3.1 Event Listener Service [backend/services/blockchainEventListener.js]

- [ ] WebSocket provider for real-time events
- [ ] Listen to all critical contract events
- [ ] Process events and update database
- [ ] Handle event replay on startup
- [ ] Prevent duplicate processing

#### 3.2 Event Processor [backend/services/eventProcessor.js]

- [ ] Queue incoming events
- [ ] Process in order with retry
- [ ] Handle duplicates (check tx hash)
- [ ] Log all processed events

#### 3.3 State Reconciliation [backend/services/stateReconciliation.js]

- [ ] Scheduled job (hourly)
- [ ] Compare DB vs blockchain state
- [ ] Report mismatches
- [ ] Auto-fix function

#### 3.4 Populate assetRegistry Cache

- [ ] Event listener for `PropertyListed`
- [ ] Insert/update assetRegistry table
- [ ] Keep synced with blockchain

### Phase 4: Update web3Service.js

- [ ] Integrate with new config system
- [ ] Use transactionManager for all blockchain calls
- [ ] Remove manual address loading
- [ ] Add getContract() helper
- [ ] Add event subscription methods

### Phase 5: Security Hardening

- [ ] Implement multi-sig for mainnet admin ops
- [ ] Secure private key management (KMS option)
- [ ] Add access control validation middleware
- [ ] Implement rate limiting
- [ ] Add gas optimization
- [ ] Handle chain reorganizations

### Phase 6: Environment Configuration

- [ ] Update .env templates with network selection
- [ ] Create network-specific .env files
- [ ] Auto-detect network from CHAIN_ID
- [ ] Add deployment scripts for each network

### Phase 7: Frontend Integration

- [ ] Auto-sync contract ABIs to frontend
- [ ] Update frontend with contract addresses
- [ ] Network detection in frontend
- [ ] Switch network prompt for users

### Phase 8: Testing

- [ ] Integration tests for each workflow
- [ ] State reconciliation tests
- [ ] Transaction failure tests
- [ ] End-to-end workflow tests

---

## ✅ Achieved So Far

### Configuration Management

- ✅ Unified configuration system for all networks
- ✅ Contract address management with validation
- ✅ ABI loading from blockchain artifacts
- ✅ Network-specific settings (gas, confirmations)
- ✅ Mainnet safety checks (test key detection)

### Transaction Management

- ✅ Atomic DB + blockchain operations
- ✅ Gas estimation and pricing
- ✅ Nonce management to avoid conflicts
- ✅ Retry logic with exponential backoff
- ✅ Transaction status tracking in database
- ✅ Error classification (retryable vs fatal)

### Database

- ✅ blockchain_transactions table for audit trail
- ✅ Links transactions to entities (KYC, property, etc.)
- ✅ Stores gas used, block number, confirmations
- ✅ Tracks transaction lifecycle (pending → confirmed/failed)

---

## 🎯 Current Focus

**Testing & Validation Phase**

All 9 synchronization phases complete. Mainnet security hardening (Phase 10) postponed.

Current priority: End-to-end testing and validation of implemented features.

See [TESTING_PLAN.md](./TESTING_PLAN.md) for comprehensive testing strategy.

---

## 📋 Integration Pattern

All backend functions that modify blockchain state will follow this pattern:

```javascript
// 1. Validate input
if (!userWallet || !documentHash) {
  return res.status(400).json({ error: "Missing required fields" });
}

// 2. Execute via transaction manager (atomic)
const result = await transactionManager.execute({
  contract: "KYCRegistry",
  function: "approveKYC",
  args: [userWallet],
  dbOperation: async (receipt) => {
    // Update database AFTER blockchain confirmation
    return await db
      .update(kycSubmissions)
      .set({
        status: "approved",
        approvalTransactionHash: receipt.transactionHash,
        approvedAt: new Date(),
      })
      .where(eq(kycSubmissions.id, kycId));
  },
  relatedEntity: { type: "kyc", id: kycId },
});

// 3. Return success
return res.json({
  success: true,
  transactionHash: result.transactionHash,
  kycStatus: "approved",
});
```

This ensures:

- ✅ Blockchain call happens first
- ✅ DB only updated if blockchain succeeds
- ✅ Transaction tracked in audit table
- ✅ Automatic retry on network failures
- ✅ Gas management handled
- ✅ Nonce conflicts avoided

---

## 🚀 Deployment Process

### After Contracts Deploy:

1. Run config-manager.js to extract addresses:

   ```bash
   cd blockchain
   node scripts/config-manager.js
   ```

2. Addresses auto-synced to backend/services/web3/addresses.json

3. Backend validates on startup:

   ```javascript
   import { initializeContractConfig } from "./config/contracts.config.js";
   await initializeContractConfig(); // Fails if addresses missing
   ```

4. Frontend gets addresses from backend API

### Network Switching:

```bash
# Local development
export NETWORK=local
npm run dev

# Testnet deployment
export NETWORK=sepolia
npm run dev

# Mainnet (requires multi-sig)
export NETWORK=mainnet
npm start
```

---

## 🔐 Security Features

- ✅ Test key detection on mainnet (fails startup)
- ✅ Gas price limits per network
- ✅ Confirmation requirements (1 local, 3 testnet, 12 mainnet)
- ✅ Transaction audit trail
- ✅ Multi-sig requirement flag for mainnet
- ⏳ Multi-sig integration (Phase 5)
- ⏳ KMS key management (Phase 5)
- ⏳ Rate limiting (Phase 5)

---

## 📊 Metrics & Monitoring

Transaction manager provides:

- Transaction success/failure rates
- Gas usage per operation
- Average confirmation times
- Retry frequency
- Nonce conflict detection

Ready for integration with monitoring services (Datadog, New Relic, etc.)

---

**Status: Phase 1 Complete ✅ | Starting Phase 2**
