import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES } from "@/lib/contracts";
import api from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { ethers } from "ethers";
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import FiatPayment from "./FiatPayment";
import InvestmentSuccess from "./InvestmentSuccess";
import WalletPayment from "./WalletPayment";

// Constants
const PAYMENT_METHODS = {
  FIAT: "fiat",
  CRYPTO: "crypto",
};

const MODAL_STEPS = {
  AMOUNT: "amount",
  PAYMENT: "payment",
  SUCCESS: "success",
};

const MICRO_USD_FACTOR = 1_000_000;
const DEFAULT_CRYPTO_TOKENS = ["RWAP", "ETH", "USDC", "USDT"];

const resolveCryptoTokens = () => {
  const raw = import.meta.env.VITE_SUPPORTED_CRYPTO;
  if (!raw) return DEFAULT_CRYPTO_TOKENS;

  const tokens = raw
    .split(",")
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);

  return tokens.length > 0 ? tokens : DEFAULT_CRYPTO_TOKENS;
};

/**
 * Property Info Card Component
 * Displays property details and investment parameters
 */
const PropertyInfoCard = ({ property }) => {
  const propertyMetrics = useMemo(() => {
    // API returns propertyValue (in micro-USD), tokenPrice (in micro-USD),
    // totalFractionalSupply (ether string from chain)
    const valuation =
      (property?.propertyValue || property?.valuation || 0) / 1_000_000;
    const sharePrice =
      (property?.tokenPrice || property?.sharePrice || 1_000_000) / 1_000_000;
    const minInvestment =
      (property?.minInvestment || sharePrice * 1_000_000) / 1_000_000;
    const availableShares = property?.availableShares
      ? ethers.formatEther(property.availableShares)
      : (property?.totalFractionalSupply || "0").toString();

    return { valuation, sharePrice, minInvestment, availableShares };
  }, [property]);

  return (
    <Card className="p-4 sm:p-5 border-border bg-card space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {property?.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {property?.location}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total Value
          </p>
          <p className="text-lg font-bold text-foreground">
            $
            {propertyMetrics.valuation.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Share Price
          </p>
          <p className="text-lg font-bold text-primary">
            ${propertyMetrics.sharePrice.toFixed(2)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Min Investment
          </p>
          <p className="text-lg font-bold text-foreground">
            ${propertyMetrics.minInvestment.toFixed(2)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Available Shares
          </p>
          <p className="text-lg font-bold text-secondary">
            {parseFloat(propertyMetrics.availableShares).toLocaleString(
              "en-US",
              {
                maximumFractionDigits: 2,
              },
            )}
          </p>
        </div>
      </div>
    </Card>
  );
};

/**
 * Investment Summary Card Component
 * Shows calculated shares based on investment amount
 */
const InvestmentSummaryCard = ({ amount, shares, paymentMethod }) => (
  <Card className="p-4 border-primary/30 bg-primary/5 space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-muted-foreground">
        You will receive
      </p>
      <div className="text-right">
        <p className="text-sm text-muted-foreground">RWA Tokens</p>
      </div>
    </div>
    <div className="text-3xl font-bold text-primary">
      {parseFloat(shares).toLocaleString("en-US", { maximumFractionDigits: 6 })}
    </div>
    <div className="text-xs text-muted-foreground">
      For investment of
      {paymentMethod === PAYMENT_METHODS.CRYPTO ? " " : " $"}
      {parseFloat(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}
      {paymentMethod === PAYMENT_METHODS.CRYPTO ? " RWAP" : ""}
    </div>
  </Card>
);

/**
 * Payment Method Selector Component
 * Allows user to choose between fiat and crypto payment
 */
const PaymentMethodSelector = ({ selected, onChange }) => (
  <div className="space-y-3">
    <Label className="text-sm font-semibold text-foreground">
      Payment Method
    </Label>
    <div className="grid grid-cols-2 gap-3">
      {[
        { id: PAYMENT_METHODS.FIAT, label: "Card/Bank", icon: "💳" },
        { id: PAYMENT_METHODS.CRYPTO, label: "Cryptocurrency", icon: "🪙" },
      ].map((method) => (
        <Button
          key={method.id}
          onClick={() => onChange(method.id)}
          variant={selected === method.id ? "default" : "outline"}
          className={
            selected === method.id
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border-border text-foreground hover:bg-muted"
          }
        >
          <span className="mr-2 text-lg">{method.icon}</span>
          <span>{method.label}</span>
        </Button>
      ))}
    </div>
  </div>
);

/**
 * Amount Input Component
 * Handles investment amount input with validation
 */
const AmountInput = ({
  value,
  onChange,
  minAmount,
  maxAmount,
  paymentMethod,
}) => (
  <div className="space-y-2">
    <Label
      htmlFor="investment-amount"
      className="text-sm font-semibold text-foreground"
    >
      Investment Amount
      {paymentMethod === PAYMENT_METHODS.CRYPTO ? " (RWAP)" : " (USD)"}
    </Label>
    <Input
      id="investment-amount"
      type="number"
      placeholder="Enter amount"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={minAmount}
      max={maxAmount}
      step="0.01"
      className="border-border bg-input text-foreground placeholder:text-muted-foreground"
    />
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>
        Min: {minAmount.toFixed(2)}
        {paymentMethod === PAYMENT_METHODS.CRYPTO ? " RWAP" : " USD"}
      </span>
      <span>
        Max: {maxAmount.toFixed(2)}
        {paymentMethod === PAYMENT_METHODS.CRYPTO ? " RWAP" : " USD"}
      </span>
    </div>
  </div>
);

/**
 * Error Alert Component
 * Displays error messages with icon
 */
const ErrorAlert = ({ message, variant = "destructive" }) => (
  <Alert className={`border-${variant}/30 bg-${variant}/5`}>
    <AlertCircle className={`h-4 w-4 text-${variant}`} />
    <AlertDescription className={`text-${variant} ml-2`}>
      {message}
    </AlertDescription>
  </Alert>
);

/**
 * InvestmentModal Component
 * Multi-step modal for property investment process.
 * Handles eligibility checks, amount validation, and payment processing.
 *
 * @param {boolean} isOpen - Modal open state
 * @param {Function} onClose - Callback to close modal
 * @param {Object} property - Property details for investment
 */
const InvestmentModal = ({ isOpen, onClose, property }) => {
  const queryClient = useQueryClient();
  const { account, isConnected } = useWallet();
  const { user, isAuthenticated } = useAuth();

  const cryptoTokens = useMemo(() => resolveCryptoTokens(), []);
  const [cryptoToken, setCryptoToken] = useState(
    () => cryptoTokens[0] || "RWAP",
  );

  const [step, setStep] = useState(MODAL_STEPS.AMOUNT);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.FIAT);
  const [amount, setAmount] = useState("");
  const [shares, setShares] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpeningPool, setIsOpeningPool] = useState(false);
  const [error, setError] = useState(null);
  const [investmentData, setInvestmentData] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [poolForm, setPoolForm] = useState({
    pricePerToken: "",
    minInvestment: "",
  });
  const [cryptoPoolInfo, setCryptoPoolInfo] = useState({
    loading: false,
    minInvestmentRwap: null,
    maxInvestmentRwap: null,
    pricePerTokenRwap: null,
    isOpen: true,
    availableFractionalTokens: null,
    error: null,
  });

  // Memoize property metrics to avoid recalculation
  const propertyMetrics = useMemo(() => {
    if (!property) return null;

    const parsePositiveNumber = (value, fallback) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const sharePriceMicro = parsePositiveNumber(
      property.tokenPrice ?? property.sharePrice,
      MICRO_USD_FACTOR,
    );

    const minInvestmentMicro = parsePositiveNumber(
      property.minInvestment,
      sharePriceMicro,
    );

    const maxInvestmentMicro = parsePositiveNumber(
      property.propertyValue ?? property.valuation,
      sharePriceMicro * 1000,
    );

    return {
      minInvestment: minInvestmentMicro / MICRO_USD_FACTOR,
      maxInvestment: maxInvestmentMicro / MICRO_USD_FACTOR,
      sharePrice: sharePriceMicro / MICRO_USD_FACTOR,
      sharePriceMicro,
    };
  }, [property]);

  const effectiveMinInvestment = useMemo(() => {
    if (!propertyMetrics) return 0;
    if (paymentMethod !== PAYMENT_METHODS.CRYPTO) {
      return propertyMetrics.minInvestment;
    }

    if (Number.isFinite(cryptoPoolInfo.minInvestmentRwap)) {
      // RWAP is treated as 1:1 USD in this flow.
      return Math.max(
        propertyMetrics.minInvestment,
        cryptoPoolInfo.minInvestmentRwap,
      );
    }

    return propertyMetrics.minInvestment;
  }, [propertyMetrics, paymentMethod, cryptoPoolInfo.minInvestmentRwap]);

  const effectiveMaxInvestment = useMemo(() => {
    if (!propertyMetrics) return 0;

    if (
      paymentMethod === PAYMENT_METHODS.CRYPTO &&
      Number.isFinite(cryptoPoolInfo.maxInvestmentRwap)
    ) {
      return cryptoPoolInfo.maxInvestmentRwap;
    }

    return Math.max(
      propertyMetrics.maxInvestment,
      propertyMetrics.minInvestment,
    );
  }, [propertyMetrics, paymentMethod, cryptoPoolInfo.maxInvestmentRwap]);

  const normalizedMaxInvestment = useMemo(() => {
    return Math.max(effectiveMaxInvestment, effectiveMinInvestment);
  }, [effectiveMaxInvestment, effectiveMinInvestment]);

  const normalizedCryptoToken = useMemo(
    () => (cryptoToken || "RWAP").toUpperCase(),
    [cryptoToken],
  );

  const isAdmin = user?.role === "admin";
  const showAdminPoolControls =
    isAdmin &&
    paymentMethod === PAYMENT_METHODS.CRYPTO &&
    !cryptoPoolInfo.loading &&
    !cryptoPoolInfo.isOpen;

  useEffect(() => {
    if (!propertyMetrics) return;
    setPoolForm((prev) => ({
      pricePerToken:
        prev.pricePerToken || propertyMetrics.sharePrice.toFixed(2),
      minInvestment:
        prev.minInvestment || propertyMetrics.minInvestment.toFixed(2),
    }));
  }, [propertyMetrics, property?.id]);

  // Check investment eligibility on modal open
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      checkEligibility();
    }
  }, [isOpen, isAuthenticated]);

  const loadCryptoPoolInfo = useCallback(async () => {
    if (!property?.nftTokenId) {
      setCryptoPoolInfo({
        loading: false,
        minInvestmentRwap: null,
        maxInvestmentRwap: null,
        pricePerTokenRwap: null,
        isOpen: false,
        availableFractionalTokens: null,
        error: "This property is not linked to an on-chain pool",
      });
      return;
    }

    if (!ethers.isAddress(CONTRACT_ADDRESSES.INVESTMENT_MANAGER)) {
      setCryptoPoolInfo({
        loading: false,
        minInvestmentRwap: null,
        maxInvestmentRwap: null,
        pricePerTokenRwap: null,
        isOpen: false,
        availableFractionalTokens: null,
        error: "Investment contract is not configured",
      });
      return;
    }

    setCryptoPoolInfo((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const provider = new ethers.JsonRpcProvider(
        import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545",
      );
      const investmentManager = new ethers.Contract(
        CONTRACT_ADDRESSES.INVESTMENT_MANAGER,
        CONTRACT_ABIS.INVESTMENT_MANAGER,
        provider,
      );

      const pool = await investmentManager.investmentPools(
        BigInt(property.nftTokenId),
      );

      const maxInvestableWei =
        pool.availableFractionalTokens > 0n
          ? (pool.availableFractionalTokens * pool.pricePerToken) / 10n ** 18n
          : 0n;

      setCryptoPoolInfo({
        loading: false,
        minInvestmentRwap: Number(ethers.formatUnits(pool.minInvestment, 18)),
        maxInvestmentRwap: Number(ethers.formatUnits(maxInvestableWei, 18)),
        pricePerTokenRwap: Number(ethers.formatUnits(pool.pricePerToken, 18)),
        isOpen: Boolean(pool.isOpen),
        availableFractionalTokens: pool.availableFractionalTokens,
        error: null,
      });
    } catch (err) {
      setCryptoPoolInfo({
        loading: false,
        minInvestmentRwap: null,
        maxInvestmentRwap: null,
        pricePerTokenRwap: null,
        isOpen: false,
        availableFractionalTokens: null,
        error: err?.message || "Failed to load on-chain pool details",
      });
    }
  }, [property?.nftTokenId]);

  useEffect(() => {
    if (
      isOpen &&
      paymentMethod === PAYMENT_METHODS.CRYPTO &&
      property?.nftTokenId !== undefined &&
      property?.nftTokenId !== null &&
      property?.nftTokenId !== ""
    ) {
      loadCryptoPoolInfo();
    }
  }, [isOpen, paymentMethod, property?.nftTokenId, loadCryptoPoolInfo]);

  // Calculate shares when amount changes
  useEffect(() => {
    if (amount && propertyMetrics) {
      calculateShares();
    }
  }, [amount, propertyMetrics]);

  // Check if user is eligible to invest
  const checkEligibility = useCallback(async () => {
    try {
      const response = await api.get("/investment/check-eligibility");
      setEligibility(response.data.data);

      if (!response.data.data.canInvest) {
        const reason = !response.data.data.hasUserRole
          ? "You need USER role to invest"
          : "KYC approval required to invest";
        setError(reason);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug("Eligibility check failed:", err);
      }
      setError("Failed to verify investment eligibility");
    }
  }, []);

  // Calculate shares based on investment amount
  const calculateShares = useCallback(async () => {
    try {
      const investmentAmount = parseFloat(amount);
      if (isNaN(investmentAmount) || investmentAmount <= 0) {
        setShares("0");
        return;
      }

      const amountInMicroUsd = Math.round(investmentAmount * MICRO_USD_FACTOR);
      const calculatedShares =
        amountInMicroUsd / propertyMetrics.sharePriceMicro;

      setShares(calculatedShares.toFixed(6));
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug("Share calculation failed:", err);
      }
      setShares("0");
    }
  }, [amount, propertyMetrics]);

  // Validate and proceed to payment step
  const handleAmountSubmit = useCallback(() => {
    const investmentAmount = parseFloat(amount);

    if (!investmentAmount || investmentAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (paymentMethod === PAYMENT_METHODS.CRYPTO) {
      if (cryptoPoolInfo.loading) {
        setError("Loading on-chain pool rules. Please wait a moment.");
        return;
      }

      if (cryptoPoolInfo.error) {
        setError(
          "Unable to read on-chain pool constraints. Please reconnect wallet and try again.",
        );
        return;
      }

      if (!cryptoPoolInfo.isOpen) {
        setError("Investment pool is not open for this property.");
        return;
      }

      if (
        cryptoPoolInfo.availableFractionalTokens !== null &&
        cryptoPoolInfo.availableFractionalTokens <= 0n
      ) {
        setError("No fractional tokens are available in this pool.");
        return;
      }
    }

    if (investmentAmount < effectiveMinInvestment) {
      setError(
        paymentMethod === PAYMENT_METHODS.CRYPTO
          ? `Minimum crypto investment is ${effectiveMinInvestment.toFixed(2)} RWAP`
          : `Minimum investment is $${effectiveMinInvestment.toFixed(2)}`,
      );
      return;
    }

    if (investmentAmount > normalizedMaxInvestment) {
      setError(
        paymentMethod === PAYMENT_METHODS.CRYPTO
          ? `Maximum crypto investment is ${normalizedMaxInvestment.toFixed(2)} RWAP`
          : `Maximum investment is $${normalizedMaxInvestment.toFixed(2)}`,
      );
      return;
    }

    if (
      paymentMethod === PAYMENT_METHODS.CRYPTO &&
      (property.nftTokenId === undefined ||
        property.nftTokenId === null ||
        property.nftTokenId === "")
    ) {
      setError(
        "This property is not linked to an on-chain pool for crypto investment",
      );
      return;
    }

    setError(null);
    setStep(MODAL_STEPS.PAYMENT);
  }, [
    amount,
    propertyMetrics,
    paymentMethod,
    property.nftTokenId,
    effectiveMinInvestment,
    normalizedMaxInvestment,
    cryptoPoolInfo,
  ]);

  const handleOpenPool = useCallback(async () => {
    if (!property?.id) {
      setError("Property data is not loaded yet.");
      return;
    }

    if (!property?.nftTokenId) {
      setError("Property must be tokenized before opening an investment pool.");
      return;
    }

    const pricePerToken = parseFloat(poolForm.pricePerToken);
    const minInvestment = parseFloat(poolForm.minInvestment);

    if (!Number.isFinite(pricePerToken) || pricePerToken <= 0) {
      setError("Enter a valid price per token.");
      return;
    }

    if (!Number.isFinite(minInvestment) || minInvestment <= 0) {
      setError("Enter a valid minimum investment amount.");
      return;
    }

    setIsOpeningPool(true);
    setError(null);

    try {
      const response = await api.post(
        `/admin/properties/${property.id}/create-pool`,
        {
          pricePerToken,
          minInvestment,
        },
      );

      if (!response?.data?.success) {
        throw new Error(response?.data?.message || "Failed to open pool");
      }

      toast.success("Investment pool opened", {
        description: response?.data?.message || "Pool is now available",
      });

      await loadCryptoPoolInfo();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to open investment pool.",
      );
    } finally {
      setIsOpeningPool(false);
    }
  }, [property, poolForm, loadCryptoPoolInfo]);

  // Handle investment creation after payment
  const handleInvestment = useCallback(
    async (paymentReference) => {
      if (!eligibility?.canInvest) {
        setError("You are not eligible to invest");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const amountInCents = Math.round(parseFloat(amount) * MICRO_USD_FACTOR);

        const response = await api.post("/investment/create", {
          propertyId: property.id,
          amount: amountInCents,
          paymentMethod,
          paymentReference,
        });

        const serverData = response?.data?.data || {};
        const resolvedTxHash =
          serverData.txHash || serverData.transactionHash || paymentReference;
        const resolvedTimestamp =
          serverData.timestamp ||
          serverData.investedAt ||
          new Date().toISOString();

        setInvestmentData({
          ...serverData,
          txHash: resolvedTxHash,
          timestamp: resolvedTimestamp,
          method: paymentMethod === PAYMENT_METHODS.CRYPTO ? "wallet" : "card",
          property: {
            name: property.title,
            expectedReturn: property.expectedReturn || 8,
            recipientAddress:
              property.ownerWallet || import.meta.env.VITE_TREASURY_ADDRESS,
          },
          amount: parseFloat(amount),
          shares: parseFloat(shares),
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["investments"] }),
          queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
          queryClient.invalidateQueries({
            queryKey: ["portfolio", "holdings"],
          }),
          queryClient.invalidateQueries({
            queryKey: ["portfolio", "performance"],
          }),
        ]);

        setStep(MODAL_STEPS.SUCCESS);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Investment creation failed. Please try again.",
        );
        if (import.meta.env.DEV) {
          console.debug("Investment error:", err);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [amount, shares, paymentMethod, property, eligibility, queryClient],
  );

  // Reset modal state on close
  const handleClose = useCallback(() => {
    setStep(MODAL_STEPS.AMOUNT);
    setAmount("");
    setShares("0");
    setError(null);
    setInvestmentData(null);
    onClose();
  }, [onClose]);

  // Guard: Property not available
  if (!property) {
    return null;
  }

  // Guard: User not authenticated and wallet not connected
  const isAccessible = isConnected && isAuthenticated;
  const canInvest = eligibility?.canInvest;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-border bg-background">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-bold text-foreground">
            {step === MODAL_STEPS.AMOUNT && "Invest in Property"}
            {step === MODAL_STEPS.PAYMENT && "Complete Payment"}
            {step === MODAL_STEPS.SUCCESS && "Investment Successful"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {step === MODAL_STEPS.AMOUNT &&
              "Choose your investment amount and payment method"}
            {step === MODAL_STEPS.PAYMENT &&
              "Proceed with your selected payment method"}
            {step === MODAL_STEPS.SUCCESS &&
              "Your investment has been processed successfully"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Access Guards */}
          {!isConnected && (
            <ErrorAlert message="Please connect your wallet to invest" />
          )}

          {!isAuthenticated && isConnected && (
            <ErrorAlert message="Please sign in to invest" />
          )}

          {isAccessible && eligibility && !canInvest && (
            <ErrorAlert
              message={
                !eligibility.hasUserRole
                  ? "You need USER role to invest. Please complete registration."
                  : "KYC approval required. Please complete your KYC verification."
              }
            />
          )}

          {error && <ErrorAlert message={error} />}

          {showAdminPoolControls && (
            <Card className="p-4 border-amber-400/40 bg-amber-500/5 space-y-3">
              <div className="text-sm font-semibold text-foreground">
                Admin: Open Investment Pool
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="pool-price">Price Per Token (RWAP)</Label>
                  <Input
                    id="pool-price"
                    type="number"
                    step="0.01"
                    value={poolForm.pricePerToken}
                    onChange={(e) =>
                      setPoolForm((prev) => ({
                        ...prev,
                        pricePerToken: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pool-min">Min Investment (RWAP)</Label>
                  <Input
                    id="pool-min"
                    type="number"
                    step="0.01"
                    value={poolForm.minInvestment}
                    onChange={(e) =>
                      setPoolForm((prev) => ({
                        ...prev,
                        minInvestment: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <Button
                onClick={handleOpenPool}
                disabled={isOpeningPool}
                className="w-full"
              >
                {isOpeningPool ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening Pool...
                  </>
                ) : (
                  "Open Pool"
                )}
              </Button>
            </Card>
          )}

          {/* Step 1: Amount Selection */}
          {step === MODAL_STEPS.AMOUNT && isAccessible && (
            <div className="space-y-5">
              <PropertyInfoCard property={property} />

              <div className="space-y-4">
                <AmountInput
                  value={amount}
                  onChange={setAmount}
                  minAmount={effectiveMinInvestment}
                  maxAmount={normalizedMaxInvestment}
                  paymentMethod={paymentMethod}
                />

                {paymentMethod === PAYMENT_METHODS.CRYPTO && (
                  <Alert className="border-primary/30 bg-primary/5">
                    {cryptoPoolInfo.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-primary" />
                    )}
                    <AlertDescription className="text-primary ml-2">
                      {cryptoPoolInfo.loading
                        ? "Fetching on-chain pool limits..."
                        : `On-chain range for this property: ${effectiveMinInvestment.toFixed(2)} - ${normalizedMaxInvestment.toFixed(2)} RWAP`}
                    </AlertDescription>
                  </Alert>
                )}

                {amount && (
                  <InvestmentSummaryCard
                    amount={amount}
                    shares={shares}
                    paymentMethod={paymentMethod}
                  />
                )}

                <PaymentMethodSelector
                  selected={paymentMethod}
                  onChange={setPaymentMethod}
                />

                {paymentMethod === PAYMENT_METHODS.CRYPTO && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground">
                      Crypto Token
                    </Label>
                    <Select
                      value={normalizedCryptoToken}
                      onValueChange={setCryptoToken}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select token" />
                      </SelectTrigger>
                      <SelectContent>
                        {cryptoTokens.map((token) => (
                          <SelectItem key={token} value={token}>
                            {token}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {normalizedCryptoToken === "ETH" ? (
                      <p className="text-xs text-muted-foreground">
                        ETH payments auto-convert to RWAP during checkout.
                      </p>
                    ) : normalizedCryptoToken !== "RWAP" ? (
                      <p className="text-xs text-muted-foreground">
                        {normalizedCryptoToken} payments are coming soon.
                      </p>
                    ) : null}
                  </div>
                )}

                <Button
                  onClick={handleAmountSubmit}
                  disabled={!amount || !canInvest || isLoading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Payment</span>
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === MODAL_STEPS.PAYMENT && (
            <div>
              {paymentMethod === PAYMENT_METHODS.FIAT ? (
                <FiatPayment
                  property={property}
                  amount={parseFloat(amount)}
                  shares={parseFloat(shares)}
                  onSuccess={handleInvestment}
                  onBack={() => setStep(MODAL_STEPS.AMOUNT)}
                />
              ) : (
                <WalletPayment
                  property={{
                    name: property.title,
                    nftTokenId: property.nftTokenId,
                    pricePerShare: propertyMetrics.sharePrice,
                  }}
                  amount={parseFloat(amount)}
                  shares={parseFloat(shares)}
                  paymentToken={normalizedCryptoToken}
                  onSuccess={handleInvestment}
                  onBack={() => setStep(MODAL_STEPS.AMOUNT)}
                />
              )}
            </div>
          )}

          {/* Step 3: Success */}
          {step === MODAL_STEPS.SUCCESS && investmentData && (
            <InvestmentSuccess
              property={investmentData.property}
              transactionData={investmentData}
              amount={investmentData.amount}
              shares={investmentData.shares}
              estimatedReturn={
                (investmentData.amount *
                  (investmentData.property.expectedReturn || 8)) /
                100
              }
              onClose={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvestmentModal;
