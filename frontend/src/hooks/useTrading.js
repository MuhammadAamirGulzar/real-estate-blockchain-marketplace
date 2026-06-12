import { WalletContext } from "@/contexts/WalletContext";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { tradingService } from "@/services/trading.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ethers } from "ethers";
import { useContext } from "react";
import { toast } from "sonner";

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const TRADING_KEYS = {
  orders: (propertyId) => ["trading", "orders", propertyId],
  marketData: (propertyId) => ["trading", "market", propertyId],
  userOrders: ["trading", "user-orders"],
  history: ["trading", "history"],
};

// ─── Helper: get contract instance ───────────────────────────────────────────
function getMarketContract(signerOrProvider) {
  const address = CONTRACT_ADDRESSES.SECONDARY_MARKET;
  if (!address)
    throw new Error("SecondaryMarket contract address not configured");
  return new ethers.Contract(
    address,
    CONTRACT_ABIS.SECONDARY_MARKET,
    signerOrProvider,
  );
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Active sell/buy orders for a specific property (from blockchain via backend) */
export function usePropertyOrders(propertyId) {
  return useQuery({
    queryKey: TRADING_KEYS.orders(propertyId),
    queryFn: () => tradingService.getOrders(propertyId),
    enabled: !!propertyId,
    staleTime: 1000 * 20,
    select: (data) =>
      data?.data || { orders: [], propertyTitle: "", assetId: null },
  });
}

/** Market stats (volume, last price, recent trades) for a property */
export function useMarketData(propertyId) {
  return useQuery({
    queryKey: TRADING_KEYS.marketData(propertyId),
    queryFn: () => tradingService.getMarketData(propertyId),
    enabled: !!propertyId,
    staleTime: 1000 * 60,
    select: (data) => data?.data || null,
  });
}

/** Current user's active orders (DB + chain) */
export function useUserOrders() {
  return useQuery({
    queryKey: TRADING_KEYS.userOrders,
    queryFn: () => tradingService.getUserOrders(),
    staleTime: 1000 * 30,
    select: (data) => data?.data || { dbListings: [], chainOrders: [] },
  });
}

/** Current user's trade history (as buyer) */
export function useTradingHistory() {
  return useQuery({
    queryKey: TRADING_KEYS.history,
    queryFn: () => tradingService.getTradingHistory(),
    staleTime: 1000 * 60,
    select: (data) => data?.data || [],
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create a SELL order on-chain, then record it in the backend DB.
 *
 * Usage:
 *   const { mutate: createSellOrder, isPending } = useCreateSellOrder();
 *   createSellOrder({ propertyId, assetId, tokenAmount, pricePerTokenEth, durationDays });
 *
 * Notes:
 *   - User must have approved SecondaryMarket to transfer their RWA tokens first.
 *   - pricePerTokenEth is a human-readable string like "0.001".
 *     Contract stores it as Wei-per-token-unit (scaled ×1e18).
 */
export function useCreateSellOrder() {
  const queryClient = useQueryClient();
  const { signer } = useContext(WalletContext);

  return useMutation({
    mutationFn: async ({
      propertyId,
      assetId,
      tokenAmount,
      pricePerTokenEth,
      durationDays = 30,
    }) => {
      if (!signer) throw new Error("Wallet not connected");

      const contract = getMarketContract(signer);

      // Price stored as Wei-per-1e18-tokens (contract formula: total = amount * price / 1e18)
      const priceWei = ethers.parseEther(pricePerTokenEth.toString());
      // Token amounts are already in 1e18 units
      const amountWei = ethers.parseEther(tokenAmount.toString());
      const durationSecs = BigInt(durationDays * 24 * 3600);

      toast.loading("Creating sell order…", { id: "create-sell" });

      const tx = await contract.createSellOrder(
        BigInt(assetId),
        amountWei,
        priceWei,
        durationSecs,
      );
      const receipt = await tx.wait();

      // Parse OrderCreated event
      const event = receipt.logs
        ?.map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "OrderCreated");

      const orderId = event?.args?.orderId?.toString() || "0";

      toast.success("Sell order created!", { id: "create-sell" });

      // Record in backend DB
      await tradingService.recordOrder({
        propertyId,
        orderId,
        orderType: "SELL",
        amount: amountWei.toString(),
        pricePerToken: priceWei.toString(),
        txHash: receipt.hash,
      });

      return { txHash: receipt.hash, orderId };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: TRADING_KEYS.orders(vars.propertyId),
      });
      queryClient.invalidateQueries({ queryKey: TRADING_KEYS.userOrders });
    },
    onError: (err) => {
      toast.dismiss("create-sell");
      toast.error(err?.reason || err?.message || "Failed to create sell order");
    },
  });
}

/**
 * Create a BUY order on-chain (sends ETH as escrow), then record it in DB.
 *
 * Usage:
 *   createBuyOrder({ propertyId, assetId, tokenAmount, pricePerTokenEth, durationDays });
 */
export function useCreateBuyOrder() {
  const queryClient = useQueryClient();
  const { signer } = useContext(WalletContext);

  return useMutation({
    mutationFn: async ({
      propertyId,
      assetId,
      tokenAmount,
      pricePerTokenEth,
      durationDays = 30,
    }) => {
      if (!signer) throw new Error("Wallet not connected");

      const contract = getMarketContract(signer);

      const priceWei = ethers.parseEther(pricePerTokenEth.toString());
      const amountWei = ethers.parseEther(tokenAmount.toString());
      const durationSecs = BigInt(durationDays * 24 * 3600);

      // Calculate required ETH: (amount * price) / 1e18 + fee (0.25%)
      const totalValue = (amountWei * priceWei) / ethers.parseEther("1");
      const feeAmount = (totalValue * 25n) / 10000n;
      const requiredEth = totalValue + feeAmount;

      toast.loading("Creating buy order…", { id: "create-buy" });

      const tx = await contract.createBuyOrder(
        BigInt(assetId),
        amountWei,
        priceWei,
        durationSecs,
        { value: requiredEth },
      );
      const receipt = await tx.wait();

      const event = receipt.logs
        ?.map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "OrderCreated");

      const orderId = event?.args?.orderId?.toString() || "0";

      toast.success("Buy order created!", { id: "create-buy" });

      await tradingService.recordOrder({
        propertyId,
        orderId,
        orderType: "BUY",
        amount: amountWei.toString(),
        pricePerToken: priceWei.toString(),
        txHash: receipt.hash,
      });

      return { txHash: receipt.hash, orderId };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: TRADING_KEYS.orders(vars.propertyId),
      });
      queryClient.invalidateQueries({ queryKey: TRADING_KEYS.userOrders });
    },
    onError: (err) => {
      toast.dismiss("create-buy");
      toast.error(err?.reason || err?.message || "Failed to create buy order");
    },
  });
}

/**
 * Execute a sell order (buy tokens by paying ETH).
 *
 * Usage:
 *   executeSellOrder({ propertyId, orderId, listingId, amount, pricePerToken })
 *   - amount: token units (will be converted to 1e18 internally)
 *   - pricePerToken: Wei-per-token string (as returned from getOrders)
 */
export function useExecuteSellOrder() {
  const queryClient = useQueryClient();
  const { signer } = useContext(WalletContext);

  return useMutation({
    mutationFn: async ({
      propertyId,
      orderId,
      listingId,
      amount,
      pricePerToken,
    }) => {
      if (!signer) throw new Error("Wallet not connected");

      const contract = getMarketContract(signer);

      const amountWei = ethers.parseEther(amount.toString());
      const priceWei = BigInt(pricePerToken);

      // ETH required: (amount * price) / 1e18 + 0.25% fee
      const totalValue = (amountWei * priceWei) / ethers.parseEther("1");
      const feeAmount = (totalValue * 25n) / 10000n;
      const requiredEth = totalValue + feeAmount;

      toast.loading("Executing trade…", { id: `exec-${orderId}` });

      const tx = await contract.executeSellOrder(BigInt(orderId), amountWei, {
        value: requiredEth,
      });
      const receipt = await tx.wait();

      toast.success("Trade executed!", { id: `exec-${orderId}` });

      // Record in DB if listingId known
      if (listingId) {
        await tradingService.recordTrade({
          orderId,
          listingId,
          amount: amountWei.toString(),
          pricePerToken: priceWei.toString(),
          totalPrice: totalValue.toString(),
          txHash: receipt.hash,
        });
      }

      return { txHash: receipt.hash };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: TRADING_KEYS.orders(vars.propertyId),
      });
      queryClient.invalidateQueries({ queryKey: TRADING_KEYS.history });
    },
    onError: (err) => {
      toast.error(err?.reason || err?.message || "Trade execution failed");
    },
  });
}

/**
 * Execute a buy order (sell your tokens to a buyer).
 * No ETH sent; tokens are transferred from msg.sender.
 */
export function useExecuteBuyOrder() {
  const queryClient = useQueryClient();
  const { signer } = useContext(WalletContext);

  return useMutation({
    mutationFn: async ({
      propertyId,
      orderId,
      listingId,
      amount,
      pricePerToken,
    }) => {
      if (!signer) throw new Error("Wallet not connected");

      const contract = getMarketContract(signer);

      const amountWei = ethers.parseEther(amount.toString());

      toast.loading("Executing sell…", { id: `exec-buy-${orderId}` });

      const tx = await contract.executeBuyOrder(BigInt(orderId), amountWei);
      const receipt = await tx.wait();

      toast.success("Tokens sold!", { id: `exec-buy-${orderId}` });

      if (listingId) {
        const priceWei = BigInt(pricePerToken);
        const totalValue = (amountWei * priceWei) / ethers.parseEther("1");
        await tradingService.recordTrade({
          orderId,
          listingId,
          amount: amountWei.toString(),
          pricePerToken: priceWei.toString(),
          totalPrice: totalValue.toString(),
          txHash: receipt.hash,
        });
      }

      return { txHash: receipt.hash };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: TRADING_KEYS.orders(vars.propertyId),
      });
      queryClient.invalidateQueries({ queryKey: TRADING_KEYS.history });
    },
    onError: (err) => {
      toast.error(err?.reason || err?.message || "Order execution failed");
    },
  });
}

/**
 * Cancel your own on-chain order, then update DB.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const { signer } = useContext(WalletContext);

  return useMutation({
    mutationFn: async ({ propertyId, orderId, listingId }) => {
      if (!signer) throw new Error("Wallet not connected");

      const contract = getMarketContract(signer);
      const tx = await contract.cancelOrder(BigInt(orderId));
      const receipt = await tx.wait();

      if (listingId) {
        await tradingService.recordCancel(listingId);
      }

      return { txHash: receipt.hash };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: TRADING_KEYS.orders(vars.propertyId),
      });
      queryClient.invalidateQueries({ queryKey: TRADING_KEYS.userOrders });
      toast.success("Order cancelled");
    },
    onError: (err) => {
      toast.error(err?.reason || err?.message || "Failed to cancel order");
    },
  });
}
