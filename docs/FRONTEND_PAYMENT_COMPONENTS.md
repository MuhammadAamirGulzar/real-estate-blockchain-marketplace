# Frontend Payment Components - Integration Guide

## Overview

Complete React component library for multi-currency payment system with 10 components supporting fiat and crypto payments.

---

## 📦 Installation

### Required Dependencies

```bash
cd frontend
npm install react-dropzone wagmi viem
```

### Already Installed (from shadcn/ui)

- @radix-ui/react-dialog
- @radix-ui/react-select
- @radix-ui/react-tabs
- @radix-ui/react-checkbox
- @radix-ui/react-radio-group

---

## 🎨 Component Library

### 1. CurrencySelector

**Location:** `src/components/payment/CurrencySelector.jsx`

**Purpose:** Dropdown selector for all supported currencies (9 total)

**Usage:**

```jsx
import { CurrencySelector } from "@/components/payment";

<CurrencySelector
  value={selectedCurrency}
  onChange={setSelectedCurrency}
  type="fiat" // 'all', 'fiat', 'crypto'
  label="Select Payment Currency"
/>;
```

**Props:**

- `value` (string): Selected currency code
- `onChange` (function): Callback when currency changes
- `type` (string): Filter currencies ('all', 'fiat', 'crypto')
- `disabled` (boolean): Disable selector
- `label` (string): Label text
- `className` (string): Additional CSS classes

**Supported Currencies:**

- **Fiat:** USD, PKR, AED, EUR, GBP
- **Crypto:** RWAP, ETH, USDC, USDT

---

### 2. PaymentMethodSelector

**Location:** `src/components/payment/PaymentMethodSelector.jsx`

**Purpose:** Radio button selector for payment method (crypto vs bank transfer)

**Usage:**

```jsx
import { PaymentMethodSelector } from "@/components/payment";

<PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />;
```

**Props:**

- `value` (string): 'crypto' or 'bank_transfer'
- `onChange` (function): Callback when method changes
- `disabled` (boolean): Disable selector
- `className` (string): Additional CSS classes

**Features:**

- Visual cards with icons
- Feature comparison (instant vs 1-3 days)
- Recommended badge on crypto option

---

### 3. CryptoTokenSelector

**Location:** `src/components/payment/CryptoTokenSelector.jsx`

**Purpose:** Token selector with wallet balance display

**Usage:**

```jsx
import { CryptoTokenSelector } from "@/components/payment";

<CryptoTokenSelector
  value={selectedToken}
  onChange={setSelectedToken}
  requiredAmount={1500}
/>;
```

**Props:**

- `value` (string): Selected token (ETH, RWAP, USDC, USDT)
- `onChange` (function): Callback when token changes
- `requiredAmount` (number): Required amount (shows insufficient balance warning)
- `disabled` (boolean): Disable selector
- `className` (string): Additional CSS classes

**Features:**

- Integrates with wagmi for wallet connection
- Real-time balance fetching
- Insufficient balance warnings
- Tab-based UI with token cards

**Dependencies:**

- `wagmi` for wallet integration
- `viem` for formatting units

---

### 4. BankTransferInstructions

**Location:** `src/components/payment/BankTransferInstructions.jsx`

**Purpose:** Display bank account details and payment reference

**Usage:**

```jsx
import { BankTransferInstructions } from "@/components/payment";

<BankTransferInstructions
  investmentId={123}
  paymentReference="RWA-INV-123456-789012"
  currency="USD"
  amount={5000}
  bankInstructions={{
    bankName: "Standard Bank",
    accountName: "RWA Platform Ltd",
    accountNumber: "1234567890",
    swiftCode: "SBZAZAJJ",
    iban: "PK36MEZN0003010203045678",
  }}
  expiresAt="2026-02-19T10:00:00Z"
  onUploadProof={() => router.push("/upload-proof")}
/>;
```

**Props:**

- `investmentId` (number): Investment ID
- `paymentReference` (string): Unique payment reference
- `currency` (string): Payment currency
- `amount` (number): Amount to transfer
- `bankInstructions` (object): Bank account details
- `expiresAt` (string): Expiry timestamp
- `onUploadProof` (function): Callback for upload proof button
- `className` (string): Additional CSS classes

**Features:**

- Copy-to-clipboard for all fields
- Countdown timer to expiry
- Currency-specific formatting
- Step-by-step instructions

---

### 5. BankProofUpload

**Location:** `src/components/payment/BankProofUpload.jsx`

**Purpose:** File upload with drag-and-drop for payment proofs

**Usage:**

```jsx
import { BankProofUpload } from "@/components/payment";

<BankProofUpload
  investmentId={123}
  paymentReference="RWA-INV-123456-789012"
  onUploadSuccess={(data) => console.log("Uploaded:", data)}
  onUploadError={(error) => console.error(error)}
/>;
```

**Props:**

- `investmentId` (number): Investment ID
- `paymentReference` (string): Payment reference
- `onUploadSuccess` (function): Success callback
- `onUploadError` (function): Error callback
- `className` (string): Additional CSS classes

**Features:**

- Drag-and-drop file upload
- File type validation (JPEG, PNG, PDF)
- 10MB size limit
- IPFS upload with progress bar
- Optional transaction reference input

**Dependencies:**

- `react-dropzone` for file upload

---

### 6. PaymentStatusTracker

**Location:** `src/components/payment/PaymentStatusTracker.jsx`

**Purpose:** Stepper UI showing payment verification workflow

**Usage:**

```jsx
import { PaymentStatusTracker } from "@/components/payment";

<PaymentStatusTracker
  investmentId={123}
  initialStatus="pending"
  autoRefresh={true}
  refreshInterval={30000}
  onStatusChange={(newStatus, details) => {
    console.log("Status changed to:", newStatus);
  }}
/>;
```

**Props:**

- `investmentId` (number): Investment ID
- `initialStatus` (string): Initial payment status
- `autoRefresh` (boolean): Auto-refresh status
- `refreshInterval` (number): Refresh interval in ms (default 30s)
- `onStatusChange` (function): Status change callback
- `className` (string): Additional CSS classes

**Payment Statuses:**

- `pending` - Waiting for payment initiation
- `proof_uploaded` - Proof submitted
- `verifying` - Admin reviewing
- `verified` - Payment verified
- `completed` - Tokens minted
- `cancelled` - Payment cancelled
- `expired` - Payment expired

**Features:**

- Real-time status updates via API polling
- Visual stepper with progress indicators
- Auto-stops polling when completed/cancelled/expired
- Displays payment details (amount, reference, method)

---

### 7. CurrencyConverter

**Location:** `src/components/payment/CurrencyConverter.jsx`

**Purpose:** Real-time currency conversion calculator

**Usage:**

```jsx
import { CurrencyConverter } from "@/components/payment";

<CurrencyConverter
  fromCurrency="USD"
  toCurrency="PKR"
  amount={1000}
  onAmountChange={setAmount}
  onFromCurrencyChange={setFromCurrency}
  onToCurrencyChange={setToCurrency}
  showSwap={true}
/>;
```

**Props:**

- `fromCurrency` (string): Source currency
- `toCurrency` (string): Target currency
- `amount` (number): Amount to convert
- `onAmountChange` (function): Amount change callback
- `onFromCurrencyChange` (function): Source currency change callback
- `onToCurrencyChange` (function): Target currency change callback
- `showSwap` (boolean): Show swap button
- `className` (string): Additional CSS classes

**Features:**

- Live exchange rate fetching from `/api/oracle/currency-rate`
- Swap currencies button
- Formatted currency display with symbols
- Last update timestamp
- Auto-refresh on amount/currency change

---

### 8. MultiCurrencyPriceDisplay

**Location:** `src/components/payment/MultiCurrencyPriceDisplay.jsx`

**Purpose:** Display property price in all supported currencies

**Usage:**

```jsx
import { MultiCurrencyPriceDisplay } from "@/components/payment";

<MultiCurrencyPriceDisplay
  propertyId={456}
  basePrice={100000}
  baseCurrency="USD"
  showTrending={true}
  autoRefresh={true}
  refreshInterval={300000}
/>;
```

**Props:**

- `propertyId` (number): Property ID
- `basePrice` (number): Base price
- `baseCurrency` (string): Base currency
- `showTrending` (boolean): Show price trends
- `autoRefresh` (boolean): Auto-refresh prices
- `refreshInterval` (number): Refresh interval in ms (default 5 min)
- `className` (string): Additional CSS classes

**Features:**

- Tabbed interface (Fiat vs Crypto)
- Fetches prices from `/api/oracle/multi-currency/:propertyId`
- Auto-refresh with configurable interval
- Price trending indicators (optional)
- Currency-specific formatting

---

### 9. PendingBankTransfers (Admin)

**Location:** `src/components/payment/admin/PendingBankTransfers.jsx`

**Purpose:** Admin dashboard for verifying bank transfer proofs

**Usage:**

```jsx
import { PendingBankTransfers } from "@/components/payment";

<PendingBankTransfers />;
```

**Features:**

- Table view of pending transfers
- Filter by currency
- Bulk select and batch approval/rejection
- View payment proof documents (IPFS)
- Verification notes input
- Expiry countdown badges
- Approve/Reject workflow

**API Endpoints:**

- `GET /api/payments/pending-bank-transfers`
- `POST /api/payments/verify/:paymentProofId`
- `POST /api/payments/batch-verify`

---

### 10. OraclePriceManager (Admin)

**Location:** `src/components/payment/admin/OraclePriceManager.jsx`

**Purpose:** Admin dashboard for managing property prices and detecting anomalies

**Usage:**

```jsx
import { OraclePriceManager } from "@/components/payment";

<OraclePriceManager />;
```

**Features:**

- Price anomaly detection (±20% threshold)
- Manual price override with audit trail
- Sync prices from blockchain
- Table view of all property valuations
- Price source tracking (chainlink, manual, api)
- Oracle enable/disable status

**API Endpoints:**

- `GET /api/oracle/anomalies`
- `POST /api/oracle/manual-override/:propertyId`
- `POST /api/oracle/sync-prices`
- `GET /api/properties`

---

## 🔌 Integration Examples

### Example 1: Complete Payment Flow

```jsx
import { useState } from "react";
import {
  CurrencySelector,
  PaymentMethodSelector,
  CryptoTokenSelector,
  BankTransferInstructions,
  BankProofUpload,
  PaymentStatusTracker,
} from "@/components/payment";

function PropertyInvestmentPage({ propertyId }) {
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState("USD");
  const [paymentMethod, setPaymentMethod] = useState("crypto");
  const [token, setToken] = useState("ETH");
  const [investmentId, setInvestmentId] = useState(null);
  const [paymentRef, setPaymentRef] = useState(null);

  const handleInitiatePayment = async () => {
    if (paymentMethod === "crypto") {
      // Initiate crypto payment
      const response = await fetch("/api/payments/initiate-crypto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId,
          amount: 1000,
          currency: token,
          walletAddress: address,
        }),
      });
      const data = await response.json();
      setInvestmentId(data.investment.id);
      setStep(4); // Go to status tracker
    } else {
      // Initiate fiat payment
      const response = await fetch("/api/payments/initiate-fiat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId,
          amount: 1000,
          currency,
        }),
      });
      const data = await response.json();
      setInvestmentId(data.investment.id);
      setPaymentRef(data.paymentReference);
      setStep(3); // Go to bank instructions
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {step === 1 && (
        <>
          <CurrencySelector
            value={currency}
            onChange={setCurrency}
            type={paymentMethod === "crypto" ? "crypto" : "fiat"}
          />
          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
          {paymentMethod === "crypto" && (
            <CryptoTokenSelector
              value={token}
              onChange={setToken}
              requiredAmount={1000}
            />
          )}
          <Button onClick={handleInitiatePayment}>Initiate Payment</Button>
        </>
      )}

      {step === 3 && (
        <BankTransferInstructions
          investmentId={investmentId}
          paymentReference={paymentRef}
          currency={currency}
          amount={1000}
          onUploadProof={() => setStep(3.5)}
        />
      )}

      {step === 3.5 && (
        <BankProofUpload
          investmentId={investmentId}
          paymentReference={paymentRef}
          onUploadSuccess={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <PaymentStatusTracker investmentId={investmentId} autoRefresh={true} />
      )}
    </div>
  );
}
```

### Example 2: Property Details Page with Multi-Currency Pricing

```jsx
import { MultiCurrencyPriceDisplay } from "@/components/payment";

function PropertyDetailsPage({ property }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        {/* Property images, description, etc. */}
      </div>
      <div>
        <MultiCurrencyPriceDisplay
          propertyId={property.id}
          basePrice={property.value}
          baseCurrency={property.currency}
          autoRefresh={true}
        />
      </div>
    </div>
  );
}
```

### Example 3: Admin Dashboard

```jsx
import { PendingBankTransfers, OraclePriceManager } from "@/components/payment";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function AdminPaymentsDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Payment Management</h1>
      <Tabs defaultValue="transfers">
        <TabsList>
          <TabsTrigger value="transfers">Pending Transfers</TabsTrigger>
          <TabsTrigger value="prices">Oracle Prices</TabsTrigger>
        </TabsList>
        <TabsContent value="transfers">
          <PendingBankTransfers />
        </TabsContent>
        <TabsContent value="prices">
          <OraclePriceManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 🎨 Styling & Theming

All components use shadcn/ui components and follow Tailwind CSS conventions. They automatically adapt to your theme configuration.

### Customization

```jsx
// Override component styles
<CurrencySelector
  className="my-custom-class"
  value={currency}
  onChange={setCurrency}
/>
```

### Theme Colors

Components use these semantic colors from your theme:

- `primary` - Primary actions, selected states
- `secondary` - Secondary actions, badges
- `muted` - Background fills, disabled states
- `destructive` - Errors, rejections
- `border` - Borders and separators

---

## 🔧 Configuration

### Environment Variables

Add to `frontend/.env`:

```env
# Token Addresses (for CryptoTokenSelector)
VITE_RWAP_TOKEN_ADDRESS=0x...
VITE_USDC_TOKEN_ADDRESS=0x...
VITE_USDT_TOKEN_ADDRESS=0x...

# API Base URL
VITE_API_BASE_URL=http://localhost:5000/api
```

### Wagmi Configuration

For `CryptoTokenSelector` to work, ensure wagmi is configured:

```jsx
// src/main.jsx or App.jsx
import { WagmiConfig, createConfig, configureChains } from "wagmi";
import { sepolia } from "wagmi/chains";
import { publicProvider } from "wagmi/providers/public";

const { chains, publicClient } = configureChains([sepolia], [publicProvider()]);

const config = createConfig({
  autoConnect: true,
  publicClient,
});

function App() {
  return <WagmiConfig config={config}>{/* Your app */}</WagmiConfig>;
}
```

---

## 📡 API Integration

All components expect these API endpoints to be available:

### Payment Endpoints

- `POST /api/payments/initiate-crypto`
- `POST /api/payments/initiate-fiat`
- `POST /api/payments/upload-proof`
- `GET /api/payments/status/:investmentId`
- `GET /api/payments/instructions/:investmentId`
- `GET /api/payments/exchange-rates`
- `GET /api/payments/pending-bank-transfers`
- `POST /api/payments/verify/:paymentProofId`
- `POST /api/payments/batch-verify`

### Oracle Endpoints

- `GET /api/oracle/currency-rate/:from/:to`
- `GET /api/oracle/multi-currency/:propertyId`
- `GET /api/oracle/anomalies`
- `POST /api/oracle/manual-override/:propertyId`
- `POST /api/oracle/sync-prices`

---

## 🧪 Testing

### Component Testing

```bash
npm install -D @testing-library/react @testing-library/jest-dom
```

Example test:

```jsx
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrencySelector } from "@/components/payment";

test("currency selector changes value", () => {
  const handleChange = jest.fn();
  render(<CurrencySelector value="USD" onChange={handleChange} />);

  // Test implementation
});
```

---

## 🚨 Troubleshooting

### Issue: "Module not found: react-dropzone"

**Solution:**

```bash
npm install react-dropzone
```

### Issue: "wagmi hooks not working"

**Solution:** Ensure your app is wrapped in `<WagmiConfig>` provider

### Issue: "API 401 Unauthorized"

**Solution:** Check that authentication token is stored correctly:

```jsx
const token = localStorage.getItem("token");
```

### Issue: "IPFS upload failing"

**Solution:** Verify backend IPFS configuration (Pinata API keys)

---

## 📚 Component Dependencies

| Component           | External Dependencies |
| ------------------- | --------------------- |
| CryptoTokenSelector | wagmi, viem           |
| BankProofUpload     | react-dropzone        |
| All others          | shadcn/ui only        |

---

## 🎯 Next Steps

1. **Install Dependencies:**

   ```bash
   cd frontend
   npm install react-dropzone wagmi viem
   ```

2. **Configure Environment:**
   - Update `.env` with token addresses
   - Verify API base URL

3. **Test Components:**
   - Add components to your pages
   - Test with real API calls

4. **Customize Styling:**
   - Adjust theme colors if needed
   - Add custom className overrides

---

## 📖 Additional Resources

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Wagmi Documentation](https://wagmi.sh/)
- [React Dropzone Documentation](https://react-dropzone.js.org/)

---

**Last Updated:** February 12, 2026  
**Components:** 10 (8 user, 2 admin)  
**Total Lines:** ~2,500 lines of React code
