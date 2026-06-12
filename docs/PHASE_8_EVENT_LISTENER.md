# Phase 8 Complete: Blockchain Event Listener Service

## ✅ What Was Built

**File**: [backend/services/blockchainEventListener.js](../backend/services/blockchainEventListener.js)

A comprehensive event listener service that monitors blockchain events and syncs state changes to the database automatically.

---

## 🎯 Purpose

Ensures **blockchain is the source of truth** by listening to smart contract events in real-time and updating the database to match blockchain state.

---

## 🎧 Event Listeners Implemented

### KYC Registry Events

- ✅ **KYCSubmitted** → Updates kyc_submissions status to 'pending'
- ✅ **KYCApproved** → Updates kyc_submissions and users.kycStatus to 'approved'
- ✅ **KYCRejected** → Updates kyc_submissions and users.kycStatus to 'rejected'

### Asset Registry Events

- ✅ **PropertyListed** → Links blockchain propertyId to database property
- ✅ **VerifierAssigned** → Updates property assignedVerifierId and status
- ✅ **PropertyVerified** → Updates property status to 'verified' and records verifier
- ✅ **PropertyRejected** → Updates property status to 'rejected'

### Role Manager Events

- ✅ **RoleGrantedByAdmin** → Updates users.role based on blockchain role grant
- ✅ **RoleRevokedByAdmin** → Reverts user role to 'user' when role revoked

### Property NFT Events

- ✅ **PropertyMinted** → Updates property with nftTokenId and status 'tokenized'
- ✅ **Transfer (from zero address)** → Fallback to detect minting via Transfer event

---

## 🔥 Key Features

### 1. **Duplicate Prevention**

```javascript
this.processedEvents = new Set();
const eventId = `${eventName}:${txHash}:${logIndex}`;
if (this.processedEvents.has(eventId)) return;
```

Prevents the same event from being processed multiple times.

### 2. **Real-Time Listening**

```javascript
await eventListener.startListening("latest");
```

Listens to events as they occur on the blockchain.

### 3. **Historical Event Replay**

```javascript
await eventListener.startListening(29500000); // Start from specific block
```

Replays all past events from a given block number to sync historical data.

### 4. **Batch Processing**

```javascript
// Processes historical events in batches of 1000 blocks
for (let start = fromBlock; start < currentBlock; start += 1000) {
  await replayContractEvents("KYCRegistry", start, start + 999);
}
```

Efficiently handles large event history without overwhelming the system.

### 5. **Graceful Error Handling**

```javascript
try {
  await this.handleKYCApproved(user, approver, event);
} catch (error) {
  console.error("❌ Error handling KYCApproved:", error);
  // Continues processing other events
}
```

Individual event failures don't crash the entire listener.

### 6. **Auto-Start Option**

```bash
# In .env
BLOCKCHAIN_EVENT_LISTENER_AUTO_START=true
EVENT_LISTENER_FROM_BLOCK=latest  # or specific block number
```

---

## 📦 Usage

### Start Listening (Real-Time + Historical)

```javascript
import { blockchainEventListener } from "./services/blockchainEventListener.js";

// Start from latest block (real-time only)
await blockchainEventListener.startListening("latest");

// Start from specific block (replays history then continues real-time)
await blockchainEventListener.startListening(29500000);
```

### Stop Listening

```javascript
await blockchainEventListener.stopListening();
```

### Integrate with Backend Startup

```javascript
// In backend/index.js
import { blockchainEventListener } from './services/blockchainEventListener.js';

// After server starts
app.listen(PORT, async () => {
  console.log(\`Server running on port \${PORT}\`);

  // Start blockchain event listener
  await blockchainEventListener.startListening("latest");
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await blockchainEventListener.stopListening();
  process.exit(0);
});
```

---

## 🔄 Synchronization Flow

### Before (Without Event Listener):

```
User submits KYC → Backend updates DB → Blockchain called → SUCCESS
Admin approves KYC elsewhere → Blockchain updated → ❌ DB NOT UPDATED
```

### After (With Event Listener):

```
User submits KYC → Backend updates DB → Blockchain called → SUCCESS
Admin approves KYC elsewhere → Blockchain updated → Event emitted → ✅ Listener updates DB
```

**Benefit**: External transactions (from other apps, wallets, or scripts) automatically sync to the database.

---

## 🧪 Testing Event Listener

### Test Historical Replay

```javascript
// Replay events from Sepolia deployment block
await blockchainEventListener.startListening(6885000);
```

### Test Real-Time Sync

1. Start event listener
2. Submit KYC from frontend
3. Approve KYC from admin panel
4. Check database → Should reflect blockchain state immediately

### Test External Transactions

1. Approve KYC directly from Etherscan/Foundry
2. Check database → Should auto-update via event listener

---

## ⚠️ Important Considerations

### Rate Limiting

- RPC providers (Infura, Alchemy) have rate limits
- Use WebSocket connections for production: `wss://...` instead of `https://...`
- Consider batching strategies for large replays

### Block Confirmations

- Current implementation processes events immediately
- Consider waiting for multiple confirmations (e.g., 3-12 blocks) before updating DB
- Add `confirmations` tracking in database

### Event Replay Strategy

```javascript
// Strategy 1: Full replay (first time setup)
await eventListener.startListening(DEPLOYMENT_BLOCK);

// Strategy 2: Recent replay (after downtime)
const lastProcessedBlock = await getLastProcessedBlock();
await eventListener.startListening(lastProcessedBlock);

// Strategy 3: Real-time only (normal operation)
await eventListener.startListening("latest");
```

### Network Stability

- WebSocket connections can drop
- Implement reconnection logic for production
- Store `lastProcessedBlock` in database for resume capability

---

## 🚀 Production Checklist

- [ ] Switch RPC URL to WebSocket (`wss://`) for real-time events
- [ ] Implement reconnection logic
- [ ] Store last processed block in database
- [ ] Add monitoring/alerting for listener health
- [ ] Rate limit check with RPC provider
- [ ] Test with network outage scenarios
- [ ] Add admin dashboard to monitor sync status
- [ ] Implement block confirmation waiting (optional)

---

## 📊 Monitoring

### Log Monitoring

```bash
# Check if listener is active
tail -f logs/blockchain-events.log | grep "event listeners active"

# Monitor event processing
tail -f logs/blockchain-events.log | grep "Synced"

# Check for errors
tail -f logs/blockchain-events.log | grep "❌"
```

### Database Queries

```sql
-- Check transaction hash consistency
SELECT COUNT(*) FROM kyc_submissions
WHERE submission_transaction_hash IS NOT NULL;

SELECT COUNT(*) FROM properties
WHERE listing_transaction_hash IS NOT NULL;

-- Detect missing syncs (properties listed but no DB record)
-- Would require joining against blockchain data
```

---

## 🔮 Future Enhancements

- [ ] **State Reconciliation Job** (Phase 9) - Compare DB vs blockchain periodically
- [ ] **Event Queue** - Queue events for retry if processing fails
- [ ] **Metrics Dashboard** - Track events processed, sync lag, error rates
- [ ] **Multi-Network Support** - Listen to events on multiple chains simultaneously
- [ ] **Event Filtering** - Admin can enable/disable specific event listeners
- [ ] **Notification System** - Alert users when their transactions are confirmed

---

**Status**: Phase 8 Complete ✅  
**Next**: Phase 9 - State Reconciliation Service
