# Phase 9: State Reconciliation Service

## Overview

The State Reconciliation Service periodically compares the database state with blockchain state and detects/fixes mismatches. This ensures that the database remains the accurate reflection of blockchain truth, especially important after downtime, network issues, or external blockchain interactions.

**Blockchain is always the source of truth.**

## Why Reconciliation?

Even with bidirectional sync (transactionManager + event listener), mismatches can occur due to:

1. **Network failures** - Transaction succeeded on blockchain but database update failed
2. **System downtime** - Events occurred while backend was offline
3. **External interactions** - Smart contract calls from other dApps, wallets, or Etherscan
4. **Blockchain reorgs** - Chain reorganizations can invalidate events
5. **Event listener gaps** - Missed events during restarts or connection issues
6. **Database failures** - DB transactions failed but blockchain succeeded
7. **Race conditions** - Concurrent operations creating inconsistencies

The reconciliation service acts as a **safety net** to detect and fix these edge cases.

---

## Architecture

### Service: `stateReconciliation.js`

**Singleton service that:**

- Compares DB state with blockchain state
- Detects mismatches across KYC, properties, and user roles
- Optionally auto-fixes mismatches (blockchain → DB)
- Runs on schedule (automatic) or on-demand (manual trigger)
- Generates detailed reconciliation reports

---

## Reconciliation Functions

### 1. `reconcileKYCStatuses(autoFix)`

**Purpose:** Ensure KYC statuses in database match blockchain KYC registry.

**Process:**

1. Query all users with wallet addresses
2. For each user, call `KYCRegistry.getKYCStatus(wallet)`
3. Map blockchain status enum to DB status:
   - `0` → `"not_submitted"`
   - `1` → `"pending"`
   - `2` → `"approved"`
   - `3` → `"rejected"`
4. Compare blockchain status with:
   - `kyc_submissions.status`
   - `users.kycStatus`
5. If mismatch detected:
   - Log the discrepancy
   - Increment `kycMismatches` counter
   - If `autoFix=true`, update DB to match blockchain

**Example Mismatch:**

```
⚠️ KYC mismatch for user alice@example.com:
  - Blockchain: approved
  - DB kyc_submissions: pending
  - DB users.kycStatus: pending
  ✅ Fixed → approved
```

---

### 2. `reconcilePropertyStatuses(autoFix)`

**Purpose:** Ensure property verification states match blockchain asset registry.

**Process:**

1. Query all properties with `assetRegistryId` (properties registered on blockchain)
2. For each property, call `AssetRegistry.getProperty(propertyId)`
3. Check if property exists on blockchain (lister !== ZeroAddress)
4. Compare:
   - `blockchainProperty.isVerified` vs `properties.status === "verified"`
   - `blockchainProperty.verifier` vs `properties.assignedVerifierId`
5. If mismatch detected:
   - Log the discrepancy
   - Increment `propertyMismatches` counter
   - If `autoFix=true`:
     - Update `properties.status` if verification differs
     - Update `assignedVerifierId` if verifier differs

**Example Mismatch:**

```
⚠️ Property mismatch for Luxury Villa:
  - Blockchain verified: true
  - DB status: pending_verification
  ✅ Fixed → verified

⚠️ Verifier mismatch for Luxury Villa
  - Blockchain verifier: 0x123...
  - DB verifier ID: null
  ✅ Fixed verifier assignment
```

---

### 3. `reconcileUserRoles(autoFix)`

**Purpose:** Ensure user roles in database match blockchain role manager.

**Process:**

1. Query all users with wallet addresses
2. For each user, check blockchain roles:
   - `RoleManager.hasRole(ADMIN_ROLE, wallet)`
   - `RoleManager.hasRole(SUB_ADMIN_ROLE, wallet)`
   - `RoleManager.hasRole(VERIFIER_ROLE, wallet)`
   - `RoleManager.hasRole(USER_ROLE, wallet)`
3. Determine expected DB role based on priority:
   - Has `ADMIN_ROLE` or `SUB_ADMIN_ROLE` → `"admin"`
   - Has `VERIFIER_ROLE` → `"verifier"`
   - Has `USER_ROLE` → `"user"`
   - No roles → `"user"` (default)
4. If `users.role` doesn't match expected:
   - Log the discrepancy
   - Increment `roleMismatches` counter
   - If `autoFix=true`, update `users.role`

**Example Mismatch:**

```
⚠️ Role mismatch for user bob@example.com:
  - Blockchain roles: Admin=false, SubAdmin=false, Verifier=true, User=true
  - DB role: user
  - Expected role: verifier
  ✅ Fixed → verifier
```

---

## API Endpoints

All endpoints require `admin` role authentication.

### GET `/api/reconciliation/status`

Get last reconciliation results and current status.

**Response:**

```json
{
  "success": true,
  "data": {
    "lastRun": "2024-01-15T10:30:00.000Z",
    "results": {
      "kycMismatches": 2,
      "propertyMismatches": 1,
      "roleMismatches": 0,
      "fixed": 3,
      "errors": 0
    },
    "isReconciling": false
  }
}
```

---

### POST `/api/reconciliation/run`

Trigger manual full reconciliation (KYC + Properties + Roles).

**Body:**

```json
{
  "autoFix": true // optional, default: false
}
```

**Response:**

```json
{
  "success": true,
  "message": "Reconciliation started",
  "autoFix": true
}
```

**Note:** Runs asynchronously to avoid blocking the response.

---

### POST `/api/reconciliation/report`

Generate detailed reconciliation report.

**Body:**

```json
{
  "autoFix": false // optional, default: false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "totalMismatches": 3,
    "autoFixEnabled": false,
    "details": {
      "kyc": { "mismatches": 2, "fixed": 0 },
      "properties": { "mismatches": 1, "fixed": 0 },
      "roles": { "mismatches": 0, "fixed": 0 },
      "errors": 0
    },
    "recommendation": "Mismatches detected. Consider running with autoFix=true or investigating root cause."
  }
}
```

---

### POST `/api/reconciliation/kyc`

Reconcile KYC statuses only.

**Body:**

```json
{
  "autoFix": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "KYC reconciliation completed",
  "mismatches": 2,
  "fixed": 2
}
```

---

### POST `/api/reconciliation/properties`

Reconcile property statuses only.

---

### POST `/api/reconciliation/roles`

Reconcile user roles only.

---

### POST `/api/reconciliation/start-auto`

Start automatic reconciliation on schedule.

**Body:**

```json
{
  "intervalMinutes": 60 // optional, default: 60
}
```

**Response:**

```json
{
  "success": true,
  "message": "Automatic reconciliation started (every 60 minutes)"
}
```

---

### POST `/api/reconciliation/stop-auto`

Stop automatic reconciliation.

**Response:**

```json
{
  "success": true,
  "message": "Automatic reconciliation stopped"
}
```

---

## Configuration

### Environment Variables

```env
# Auto-start reconciliation on backend startup (optional, default: false)
STATE_RECONCILIATION_AUTO_START=true

# Reconciliation interval in minutes (optional, default: 60)
RECONCILE_INTERVAL_MINUTES=60
```

**⚠️ Production Recommendation:**

- Set `STATE_RECONCILIATION_AUTO_START=false` initially
- Start reconciliation manually after verifying system stability
- Monitor first few runs before enabling auto-start
- Use hourly intervals for production (60+ minutes)

---

## Usage Examples

### Manual Reconciliation (Detection Only)

```bash
# Generate report without fixing
curl -X POST http://localhost:3001/api/reconciliation/report \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"autoFix": false}'
```

**Use case:** Audit system health without making changes.

---

### Manual Reconciliation (Auto-Fix)

```bash
# Run full reconciliation with auto-fix
curl -X POST http://localhost:3001/api/reconciliation/run \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"autoFix": true}'
```

**Use case:** Fix detected mismatches immediately.

---

### Target-Specific Reconciliation

```bash
# Fix only KYC mismatches
curl -X POST http://localhost:3001/api/reconciliation/kyc \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"autoFix": true}'

# Fix only property mismatches
curl -X POST http://localhost:3001/api/reconciliation/properties \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"autoFix": true}'

# Fix only role mismatches
curl -X POST http://localhost:3001/api/reconciliation/roles \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"autoFix": true}'
```

**Use case:** Fix specific subsystems independently.

---

### Automatic Reconciliation

```bash
# Start automatic reconciliation (every 2 hours)
curl -X POST http://localhost:3001/api/reconciliation/start-auto \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 120}'

# Stop automatic reconciliation
curl -X POST http://localhost:3001/api/reconciliation/stop-auto \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Use case:** Continuous monitoring in production.

---

## Testing Strategy

### 1. Create Intentional Mismatches

```javascript
// Test KYC mismatch
// 1. Approve KYC on blockchain via Etherscan/external wallet
// 2. Keep DB kyc_submissions.status = "pending"
// 3. Run reconciliation → should detect and fix

// Test property mismatch
// 1. Verify property on blockchain via AssetRegistry directly
// 2. Keep DB properties.status = "pending_verification"
// 3. Run reconciliation → should detect and fix

// Test role mismatch
// 1. Grant VERIFIER_ROLE on blockchain via RoleManager
// 2. Keep DB users.role = "user"
// 3. Run reconciliation → should detect and fix
```

---

### 2. Simulate Backend Downtime

```bash
# 1. Stop backend
# 2. Perform blockchain operations (via frontend + MetaMask)
# 3. Restart backend
# 4. Event listener should sync recent events
# 5. Run reconciliation to catch any gaps
```

---

### 3. Test Auto-Fix Safety

```bash
# Run with autoFix=false first (detection only)
curl -X POST http://localhost:3001/api/reconciliation/report \
  -d '{"autoFix": false}'

# Review mismatches in response
# Then run with autoFix=true
curl -X POST http://localhost:3001/api/reconciliation/run \
  -d '{"autoFix": true}'

# Verify database updated correctly
```

---

## Production Checklist

### Before Enabling Auto-Reconciliation

- [ ] Run manual reconciliation with `autoFix=false` first
- [ ] Review generated report for expected vs unexpected mismatches
- [ ] Test auto-fix on testnet thoroughly
- [ ] Verify blockchain connections are stable (WebSocket RPC)
- [ ] Ensure adequate RPC rate limits (reconciliation queries blockchain heavily)
- [ ] Set appropriate interval (60-120 minutes recommended)
- [ ] Enable logging and monitoring
- [ ] Test graceful shutdown (stop auto-reconciliation on SIGINT)

---

### Monitoring Queries

```sql
-- Find users with potentially mismatched KYC statuses
SELECT id, email, walletAddress, kycStatus
FROM users
WHERE walletAddress IS NOT NULL
  AND kycStatus != 'approved'
ORDER BY updatedAt DESC;

-- Find properties potentially out of sync
SELECT id, title, status, assetRegistryId, assignedVerifierId
FROM properties
WHERE assetRegistryId IS NOT NULL
  AND status != 'verified'
ORDER BY updatedAt DESC;

-- Find users with potentially mismatched roles
SELECT id, email, walletAddress, role
FROM users
WHERE walletAddress IS NOT NULL
ORDER BY role, updatedAt DESC;
```

---

## Integration with Backend Startup

Add to `backend/index.js`:

```javascript
import { stateReconciliationService } from "./services/stateReconciliation.js";

// After web3Service initialization
if (process.env.STATE_RECONCILIATION_AUTO_START === "true") {
  const intervalMinutes = parseInt(
    process.env.RECONCILE_INTERVAL_MINUTES || "60",
    10,
  );
  stateReconciliationService.startAutoReconciliation(intervalMinutes);
  console.log(
    `✅ Auto-reconciliation enabled (every ${intervalMinutes} minutes)`,
  );
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  stateReconciliationService.stopAutoReconciliation();
  process.exit(0);
});
```

---

## Future Enhancements

### 1. Reconciliation History Table

Store reconciliation results in database for audit trail:

```sql
CREATE TABLE reconciliation_logs (
  id SERIAL PRIMARY KEY,
  run_at TIMESTAMP NOT NULL,
  kyc_mismatches INT NOT NULL,
  property_mismatches INT NOT NULL,
  role_mismatches INT NOT NULL,
  fixed INT NOT NULL,
  errors INT NOT NULL,
  auto_fix BOOLEAN NOT NULL,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 2. Alerting

Send alerts when:

- Mismatches exceed threshold (e.g., >10 mismatches)
- Reconciliation fails multiple times
- Auto-fix encounters errors

Integration options:

- Email notifications
- Slack/Discord webhooks
- PagerDuty for critical issues

---

### 3. Detailed Mismatch Logging

Store individual mismatches with details:

```sql
CREATE TABLE reconciliation_mismatches (
  id SERIAL PRIMARY KEY,
  reconciliation_log_id INT REFERENCES reconciliation_logs(id),
  entity_type VARCHAR(50), -- 'kyc', 'property', 'role'
  entity_id INT,
  blockchain_state JSONB,
  database_state JSONB,
  fixed BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 4. Selective Reconciliation

Add filters to reconcile only:

- Specific users by ID or wallet
- Specific properties by ID
- Recently updated entities only

---

### 5. Dry-Run Mode

Always run in dry-run first, then require confirmation for fixes.

---

## Summary

**Phase 9 Complete:**

- ✅ State reconciliation service created
- ✅ KYC status reconciliation
- ✅ Property status reconciliation
- ✅ User role reconciliation
- ✅ Auto-fix capability (blockchain → DB)
- ✅ Manual trigger API endpoints
- ✅ Automatic scheduling
- ✅ Detailed reporting

**Blockchain-Backend Sync Complete:**

- ✅ Backend → Blockchain (transactionManager)
- ✅ Blockchain → Backend (event listener)
- ✅ Periodic reconciliation (safety net)

**Next: Phase 10 - Security Hardening for Mainnet**
