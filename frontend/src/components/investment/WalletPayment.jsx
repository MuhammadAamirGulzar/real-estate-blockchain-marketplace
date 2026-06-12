import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES } from "@/lib/contracts";
import api from "@/services/api";
import { ethers } from "ethers";
import { AlertCircle, CheckCircle, Loader2, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Constants
const RWA_TOKEN_DECIMALS = 18;
const TRANSACTION_STATUSES = {
  IDLE: "idle",
  CONNECTING: "connecting",
  PROCESSING: "processing",
  SUCCESS: "success",
  ERROR: "error",
};

const RWAP_SYMBOL = "RWAP";
const ETH_SYMBOL = "ETH";
const MAX_AUTO_CONVERSION_ATTEMPTS = 1;

/**
 * Wallet Connection Card Component
 * Displays wallet connection status and connection button
 */
const WalletConnectionCard = ({ isConnected, account, status, onConnect }) => (
  <Card className="p-4 border-border bg-card">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground">Wallet Connection</span>
      </div>
      {isConnected ? (
        <CheckCircle className="w-5 h-5 text-secondary" />
      ) : (
        <AlertCircle className="w-5 h-5 text-accent" />
      )}
    </div>

    {isConnected ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Connected Address:</span>
          <span className="font-mono text-sm text-foreground">
            {account?.substring(0, 6)}...
            {account?.substring(account.length - 4)}
          </span>
        </div>
        <div className="flex items-center gap-2 p-2.5 text-sm text-secondary bg-secondary/10 border border-secondary/20 rounded-md">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>Wallet connected successfully</span>
        </div>
      </div>
    ) : (
      <Button
        onClick={onConnect}
        disabled={status === TRANSACTION_STATUSES.CONNECTING}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {status === TRANSACTION_STATUSES.CONNECTING ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4 mr-2" />
            <span>Connect Wallet</span>
          </>
        )}
      </Button>
    )}
  </Card>
);

/**
 * Payment Details Card Component
 * Displays investment transaction details
 */
const PaymentDetailsCard = ({ property, amount, shares, paymentToken }) => {
  const formatToken = (value, maxFractionDigits = 4) => {
    const numericValue = Number(value || 0);
    return numericValue.toLocaleString("en-US", {
      maximumFractionDigits: maxFractionDigits,
    });
  };

  return (
    <Card className="p-4 space-y-3 border-border bg-card">
      <h3 className="font-semibold text-foreground">Payment Details</h3>
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Property:</span>
          <span className="font-medium text-foreground">{property.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shares:</span>
          <span className="font-medium text-foreground">{shares}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Selected Token:</span>
          <span className="font-medium text-foreground">{paymentToken}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Price per Share:</span>
          <span className="font-medium text-foreground">
            ~${formatToken(property.pricePerShare, 6)}
          </span>
        </div>
        <div className="flex justify-between pt-3 border-t border-border">
          <span className="font-semibold text-muted-foreground">
            Total Amount ({RWAP_SYMBOL}):
          </span>
          <span className="text-lg font-bold text-primary">
            {formatToken(amount)} {RWAP_SYMBOL}
          </span>
        </div>
      </div>
    </Card>
  );
};

/**
 * Important Notes Card Component
 * Displays transaction warnings and guidelines
 */
const ImportantNotesCard = () => (
  <Card className="p-4 border-accent/30 bg-accent/5">
    <h4 className="mb-3 text-sm font-semibold text-accent-foreground">
      Important:
    </h4>
    <ul className="space-y-2 text-xs text-accent-foreground list-disc list-inside">
      <li>Primary payment token is RWAP for investment execution</li>
      <li>If RWAP is short, ETH can be auto-converted to RWAP first</li>
      <li>You may see two prompts: approve RWAP, then confirm investment</li>
      <li>
        Transaction fees (gas) are paid separately in the native token (
        {ETH_SYMBOL})
      </li>
      <li>Do not close this window during confirmation</li>
    </ul>
  </Card>
);

const safePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const estimateEthForRwapShortfall = async (rwapShortfall) => {
  const fallbackEthUsd = 2500;

  try {
    const response = await api.get("/payments/convert", {
      params: {
        amount: rwapShortfall,
        from: "USD",
        to: "ETH",
      },
    });

    const convertedAmount = safePositiveNumber(response?.data?.convertedAmount);
    if (convertedAmount) {
      // Keep a small buffer for price movement between estimation and send.
      return convertedAmount * 1.02;
    }
  } catch {
    // Fall through to conservative fallback estimate.
  }

  return (rwapShortfall / fallbackEthUsd) * 1.05;
};

const readApiErrorMessage = (error) => {
  const responseMessage =
    error?.response?.data?.message || error?.response?.data?.error;

  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage.trim();
  }

  return error?.message || "Request failed";
};

/**
 * Extract a user-friendly wallet error message.
 */
const readHexRevertData = (error) => {
  const candidates = [
    error?.data,
    error?.data?.data,
    error?.info?.error?.data,
    error?.error?.data,
    error?.error?.error?.data,
  ];

  return candidates.find(
    (candidate) => typeof candidate === "string" && candidate.startsWith("0x"),
  );
};

const mapInvestmentCustomError = (errorName) => {
  switch (errorName) {
    case "InvestmentManager__NotKYCApproved":
      return "Wallet is not KYC approved for investing.";
    case "InvestmentManager__PoolNotOpen":
      return "Investment pool is not open for this property.";
    case "InvestmentManager__InsufficientAmount":
      return "Entered amount is below the pool minimum.";
    case "InvestmentManager__InsufficientFractionalTokens":
      return "Pool does not have enough fractional tokens for this amount.";
    case "InvestmentManager__TransferFailed":
      return "Token transfer failed. Ensure RWAP balance is sufficient and pool configuration is complete.";
    default:
      return null;
  }
};

const formatWalletError = (error, investmentManagerContract) => {
  const revertData = readHexRevertData(error);

  if (revertData && investmentManagerContract?.interface) {
    try {
      const decoded =
        investmentManagerContract.interface.parseError(revertData);
      const mapped = mapInvestmentCustomError(decoded?.name);
      if (mapped) {
        return mapped;
      }
    } catch {
      // Fall through to generic parsing.
    }
  }

  const rawMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.reason ||
    error?.shortMessage ||
    error?.info?.error?.message ||
    error?.message ||
    "Transaction failed. Please try again.";

  const message = rawMessage.replace("execution reverted: ", "").trim();
  const lower = message.toLowerCase();

  if (lower.includes("user rejected")) {
    return "Transaction was rejected in your wallet.";
  }
  if (lower.includes("not kyc approved") || lower.includes("kyc")) {
    return "Wallet is not KYC approved for investing.";
  }
  if (lower.includes("pool not open")) {
    return "Investment pool is not open for this property.";
  }
  if (lower.includes("insufficient allowance")) {
    return "RWAP approval is insufficient. Please approve and try again.";
  }
  if (lower.includes("insufficient balance")) {
    return "Insufficient RWAP balance for this investment amount.";
  }
  if (lower.includes("automatic eth to rwap conversion failed")) {
    return "Automatic ETH to RWAP conversion failed. Ensure ETH balance covers conversion plus gas and try again.";
  }
  if (lower.includes("unknown custom error") || lower.includes("-32603")) {
    return "Transaction reverted by contract. Ensure wallet is KYC approved, RWAP balance is sufficient, and the pool is correctly configured.";
  }

  return message;
};

/**
 * WalletPayment Component
 * Handles wallet connection and cryptocurrency payment processing for property investments.
 *
 * @param {Object} property - Property details including name, nftTokenId, and price
 * @param {number} amount - Total RWAP amount to pay
 * @param {number} shares - Number of shares to purchase
 * @param {Function} onSuccess - Callback on successful transaction
 * @param {Function} onBack - Callback for back navigation
 */
export function WalletPayment({
  property,
  amount,
  shares,
  paymentToken = RWAP_SYMBOL,
  onSuccess,
  onBack,
}) {
  const { signer, account, connectWallet, isConnected, refreshBalance } =
    useWallet();
  const [status, setStatus] = useState(TRANSACTION_STATUSES.IDLE);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const paymentInFlightRef = useRef(false);
  const normalizedPaymentToken = (paymentToken || RWAP_SYMBOL).toUpperCase();

  // Update status when wallet connection state changes
  useEffect(() => {
    if (isConnected && account) {
      setStatus(TRANSACTION_STATUSES.IDLE);
      setError("");
    }
  }, [isConnected, account]);

  // Handle wallet connection
  const handleConnect = useCallback(async () => {
    setStatus(TRANSACTION_STATUSES.CONNECTING);
    setError("");

    try {
      const result = await connectWallet();

      if (!result?.success) {
        const message = (result?.error || "").toLowerCase();

        if (
          message.includes("already in progress") ||
          message.includes("pending connection")
        ) {
          setStatus(TRANSACTION_STATUSES.IDLE);
          return;
        }

        throw new Error(result?.error || "Failed to connect wallet");
      }

      setStatus(TRANSACTION_STATUSES.IDLE);
    } catch (err) {
      setError(err.message || "Failed to connect wallet");
      setStatus(TRANSACTION_STATUSES.ERROR);
    }
  }, [connectWallet]);

  // Handle payment transaction
  const handlePayment = useCallback(async () => {
    if (paymentInFlightRef.current) {
      return;
    }

    if (!isConnected || !account) {
      setError("Please connect your wallet first");
      return;
    }

    if (!signer) {
      setError(
        "Wallet signer is unavailable. Please reconnect MetaMask and try again.",
      );
      return;
    }

    if (
      normalizedPaymentToken !== RWAP_SYMBOL &&
      normalizedPaymentToken !== ETH_SYMBOL
    ) {
      setError(
        `${normalizedPaymentToken} payments are coming soon. Use RWAP or ETH for now.`,
      );
      return;
    }

    if (
      property.nftTokenId === undefined ||
      property.nftTokenId === null ||
      property.nftTokenId === ""
    ) {
      setError(
        "Property is not linked to an on-chain NFT pool. Crypto investment is unavailable.",
      );
      return;
    }

    if (!ethers.isAddress(CONTRACT_ADDRESSES.INVESTMENT_MANAGER)) {
      setError(
        "Investment contract address is not configured. Please contact support.",
      );
      return;
    }

    if (!ethers.isAddress(CONTRACT_ADDRESSES.RWA_TOKEN)) {
      setError("RWAP token address is not configured. Please contact support.");
      return;
    }

    paymentInFlightRef.current = true;
    setStatus(TRANSACTION_STATUSES.PROCESSING);
    setError("");

    let investmentManagerContract;

    try {
      const nftTokenId = BigInt(property.nftTokenId);
      const tokenAmount = ethers.parseUnits(
        amount.toString(),
        RWA_TOKEN_DECIMALS,
      );

      investmentManagerContract = new ethers.Contract(
        CONTRACT_ADDRESSES.INVESTMENT_MANAGER,
        CONTRACT_ABIS.INVESTMENT_MANAGER,
        signer,
      );

      const rwaTokenContract = new ethers.Contract(
        CONTRACT_ADDRESSES.RWA_TOKEN,
        CONTRACT_ABIS.RWA_TOKEN,
        signer,
      );

      const pool = await investmentManagerContract.investmentPools(nftTokenId);

      if (!pool.isOpen) {
        throw new Error("Pool not open");
      }

      if (tokenAmount < pool.minInvestment) {
        const minRequired = ethers.formatUnits(
          pool.minInvestment,
          RWA_TOKEN_DECIMALS,
        );
        throw new Error(
          `Entered ${Number(amount || 0).toFixed(4)} RWAP is below the pool minimum of ${Number(minRequired).toFixed(1)} RWAP`,
        );
      }

      if (pool.availableFractionalTokens <= 0n) {
        throw new Error("No fractional tokens available for this property");
      }

      if (ethers.isAddress(CONTRACT_ADDRESSES.KYC_REGISTRY)) {
        const kycRegistryContract = new ethers.Contract(
          CONTRACT_ADDRESSES.KYC_REGISTRY,
          CONTRACT_ABIS.KYC_REGISTRY,
          signer,
        );

        const isKycApproved = await kycRegistryContract.isKYCApproved(account);
        if (!isKycApproved) {
          throw new Error("Wallet is not KYC approved for investing.");
        }
      }

      const treasuryAddress = await investmentManagerContract.treasury();

      let rwaBalance = await rwaTokenContract.balanceOf(account);
      if (rwaBalance < tokenAmount) {
        if (!ethers.isAddress(treasuryAddress)) {
          throw new Error(
            "Treasury address is not configured on-chain. Please contact admin.",
          );
        }

        const provider = signer.provider;
        if (!provider) {
          throw new Error(
            "Wallet provider is unavailable. Please reconnect MetaMask.",
          );
        }

        let conversionAttempt = 0;
        while (
          rwaBalance < tokenAmount &&
          conversionAttempt < MAX_AUTO_CONVERSION_ATTEMPTS
        ) {
          const missingRwapWei = tokenAmount - rwaBalance;
          const missingRwap = Number(
            ethers.formatUnits(missingRwapWei, RWA_TOKEN_DECIMALS),
          );

          const estimatedEthAmount =
            await estimateEthForRwapShortfall(missingRwap);

          if (!estimatedEthAmount || estimatedEthAmount <= 0) {
            throw new Error("Failed to estimate ETH amount for conversion.");
          }

          // Send extra on the single automatic attempt to avoid repetitive conversion loops.
          const attemptMultiplier = 1.12;
          const ethToSendValue = estimatedEthAmount * attemptMultiplier;
          const ethToSend = ethers.parseEther(ethToSendValue.toFixed(8));

          const nativeBalance = await provider.getBalance(account);
          if (nativeBalance <= ethToSend) {
            throw new Error(
              `Insufficient ${ETH_SYMBOL} balance. Need about ${ethToSendValue.toFixed(8)} ${ETH_SYMBOL} plus gas to cover missing RWAP.`,
            );
          }

          const conversionTx = await signer.sendTransaction({
            to: treasuryAddress,
            value: ethToSend,
          });

          setTxHash(conversionTx.hash);
          await conversionTx.wait();

          try {
            await api.post(
              "/investment/convert-eth-to-rwap",
              {
                ethTxHash: conversionTx.hash,
              },
              {
                timeout: 60000,
              },
            );
          } catch (conversionError) {
            // If backend processing is delayed or idempotent, continue when balance is already sufficient.
            const refreshedBalance = await rwaTokenContract.balanceOf(account);
            if (refreshedBalance >= tokenAmount) {
              rwaBalance = refreshedBalance;
              break;
            }
            throw new Error(readApiErrorMessage(conversionError));
          }

          rwaBalance = await rwaTokenContract.balanceOf(account);
          conversionAttempt += 1;
        }

        if (rwaBalance < tokenAmount) {
          const remainingRwap = Number(
            ethers.formatUnits(tokenAmount - rwaBalance, RWA_TOKEN_DECIMALS),
          );
          throw new Error(
            `ETH conversion completed but RWAP is still short by ${remainingRwap.toFixed(4)} RWAP. Auto-conversion is capped to one attempt to prevent repeated transactions. Please retry with a higher ETH amount once.`,
          );
        }
      }

      const fractionalTokensNeeded =
        (tokenAmount * 10n ** 18n) / pool.pricePerToken;

      if (ethers.isAddress(pool.fractionalTokenContract)) {
        const fractionalTokenContract = new ethers.Contract(
          pool.fractionalTokenContract,
          CONTRACT_ABIS.FRACTIONAL_TOKEN,
          signer,
        );

        const [treasuryBalance, treasuryAllowance] = await Promise.all([
          fractionalTokenContract.balanceOf(treasuryAddress),
          fractionalTokenContract.allowance(
            treasuryAddress,
            CONTRACT_ADDRESSES.INVESTMENT_MANAGER,
          ),
        ]);

        if (treasuryBalance < fractionalTokensNeeded) {
          throw new Error(
            "Pool treasury does not have enough fractional tokens. Please contact admin.",
          );
        }

        if (treasuryAllowance < fractionalTokensNeeded) {
          try {
            await api.post("/investment/ensure-pool-allowance", {
              nftTokenId: property.nftTokenId,
              requiredAmount: fractionalTokensNeeded.toString(),
            });
          } catch (allowanceError) {
            throw new Error(readApiErrorMessage(allowanceError));
          }

          const refreshedTreasuryAllowance =
            await fractionalTokenContract.allowance(
              treasuryAddress,
              CONTRACT_ADDRESSES.INVESTMENT_MANAGER,
            );

          if (refreshedTreasuryAllowance < fractionalTokensNeeded) {
            const isTreasuryWallet =
              account?.toLowerCase() === treasuryAddress?.toLowerCase();

            if (isTreasuryWallet) {
              const approveTx = await fractionalTokenContract.approve(
                CONTRACT_ADDRESSES.INVESTMENT_MANAGER,
                ethers.MaxUint256,
              );
              setTxHash(approveTx.hash);
              await approveTx.wait();

              const postApproveAllowance =
                await fractionalTokenContract.allowance(
                  treasuryAddress,
                  CONTRACT_ADDRESSES.INVESTMENT_MANAGER,
                );

              if (postApproveAllowance >= fractionalTokensNeeded) {
                return;
              }
            }

            throw new Error(
              "Pool treasury allowance is not configured for InvestmentManager. Connect the treasury admin wallet and approve allowance.",
            );
          }
        }
      }

      const allowance = await rwaTokenContract.allowance(
        account,
        CONTRACT_ADDRESSES.INVESTMENT_MANAGER,
      );

      if (allowance < tokenAmount) {
        const approveTx = await rwaTokenContract.approve(
          CONTRACT_ADDRESSES.INVESTMENT_MANAGER,
          tokenAmount,
        );
        setTxHash(approveTx.hash);
        await approveTx.wait();
      }

      const tx = await investmentManagerContract.invest(
        nftTokenId,
        tokenAmount,
      );

      setTxHash(tx.hash);

      await tx.wait();

      if (typeof refreshBalance === "function") {
        await refreshBalance();
      }

      onSuccess?.(tx.hash);
      setStatus(TRANSACTION_STATUSES.SUCCESS);
    } catch (err) {
      setError(formatWalletError(err, investmentManagerContract));
      setStatus(TRANSACTION_STATUSES.ERROR);
    } finally {
      paymentInFlightRef.current = false;
    }
  }, [
    isConnected,
    account,
    signer,
    amount,
    property.nftTokenId,
    refreshBalance,
    onSuccess,
    normalizedPaymentToken,
  ]);

  const isProcessing = status === TRANSACTION_STATUSES.PROCESSING;
  const isSuccess = status === TRANSACTION_STATUSES.SUCCESS;

  return (
    <div className="space-y-5">
      {/* Wallet Connection */}
      <WalletConnectionCard
        isConnected={isConnected}
        account={account}
        status={status}
        onConnect={handleConnect}
      />

      {/* Payment Details */}
      <PaymentDetailsCard
        property={property}
        amount={amount}
        shares={shares}
        paymentToken={normalizedPaymentToken}
      />

      {/* Transaction Status: Processing */}
      {isProcessing && (
        <Alert className="border-accent/30 bg-accent/5">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <AlertDescription className="text-accent-foreground ml-2">
            Processing your transaction... Please confirm in your wallet and
            wait for confirmation.
          </AlertDescription>
        </Alert>
      )}

      {/* Transaction Status: Success */}
      {isSuccess && (
        <Alert className="border-secondary/30 bg-secondary/5">
          <CheckCircle className="h-4 w-4 text-secondary" />
          <AlertDescription className="text-secondary ml-2">
            Transaction successful! Hash: {txHash.substring(0, 10)}...
          </AlertDescription>
        </Alert>
      )}

      {/* Transaction Status: Error */}
      {error && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive ml-2">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Important Notes */}
      <ImportantNotesCard />

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1 border-border text-foreground hover:bg-muted"
        >
          Back
        </Button>
        {isConnected && !isSuccess && (
          <Button
            onClick={handlePayment}
            disabled={isProcessing}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>
                Pay{" "}
                {amount.toLocaleString("en-US", { maximumFractionDigits: 4 })}{" "}
                {RWAP_SYMBOL}
              </span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default WalletPayment;
