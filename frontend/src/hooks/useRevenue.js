import { WalletContext } from "@/contexts/WalletContext";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { revenueService } from "@/services/revenue.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ethers } from "ethers";
import { useContext } from "react";
import { toast } from "sonner";

// ─── Query Keys ──────────────────────────────────────────────────────────────
export const REVENUE_KEYS = {
  claimable: ["revenue", "claimable"],
  history: ["revenue", "history"],
  adminDistributions: ["revenue", "admin", "distributions"],
  adminProperties: ["revenue", "admin", "properties"],
  propertyHistory: (id) => ["revenue", "property", id, "history"],
  assetInfo: (id) => ["revenue", "asset", id, "info"],
};

// ─── Investor Hooks ───────────────────────────────────────────────────────────

/**
 * Fetch claimable revenue amounts for the logged-in investor
 * Returns per-property breakdown + total
 */
export function useClaimableRevenue() {
  return useQuery({
    queryKey: REVENUE_KEYS.claimable,
    queryFn: () => revenueService.getClaimableRevenue(),
    staleTime: 1000 * 30, // 30 s (revenue amounts change after claims)
    gcTime: 1000 * 60 * 5,
    select: (data) => data?.data || { properties: [], totalClaimable: "0" },
  });
}

/**
 * Fetch user's revenue claim history
 */
export function useRevenueHistory() {
  return useQuery({
    queryKey: REVENUE_KEYS.history,
    queryFn: () => revenueService.getClaimHistory(),
    staleTime: 1000 * 60 * 2,
    select: (data) => data?.data || [],
  });
}

/**
 * Execute on-chain claimRevenue(assetId) from the investor's wallet,
 * then record the claim in the backend database.
 *
 * Usage:
 *   const { mutate: claimRevenue, isPending } = useClaimRevenue();
 *   claimRevenue({ propertyId: 3, assetId: "1", assetTitle: "My Property" });
 */
export function useClaimRevenue() {
  const queryClient = useQueryClient();
  const { signer } = useContext(WalletContext);

  return useMutation({
    mutationFn: async ({ propertyId, assetId, propertyTitle }) => {
      if (!signer)
        throw new Error("Wallet not connected. Please connect your wallet.");

      const address = CONTRACT_ADDRESSES.REVENUE_DISTRIBUTOR;
      if (!address)
        throw new Error("RevenueDistributor contract address not configured");

      // Create contract instance connected to user's signer
      const contract = new ethers.Contract(
        address,
        CONTRACT_ABIS.REVENUE_DISTRIBUTOR,
        signer,
      );

      toast.loading(`Claiming revenue for ${propertyTitle}...`, {
        id: "claim-revenue",
      });

      // Execute on-chain claim
      const tx = await contract.claimRevenue(BigInt(assetId));
      const receipt = await tx.wait();

      toast.success(
        `Revenue claimed! TX: ${receipt.hash.substring(0, 10)}...`,
        {
          id: "claim-revenue",
        },
      );

      // Parse RevenueClaimed event to get actual amount
      const claimedEvent = receipt.logs
        ?.map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "RevenueClaimed");

      const claimedWei = claimedEvent?.args?.amount || 0n;
      const claimedEth = ethers.formatEther(claimedWei);

      // Record in backend DB
      await revenueService.recordClaim({
        propertyId,
        assetId: assetId.toString(),
        amountEth: claimedEth,
        txHash: receipt.hash,
      });

      return { txHash: receipt.hash, claimedEth };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: REVENUE_KEYS.claimable });
      queryClient.invalidateQueries({ queryKey: REVENUE_KEYS.history });
      toast.success(
        `Successfully claimed ${parseFloat(data.claimedEth).toFixed(6)} ETH`,
      );
    },
    onError: (error) => {
      toast.dismiss("claim-revenue");
      const msg = error?.reason || error?.message || "Failed to claim revenue";
      toast.error(msg);
    },
  });
}

/**
 * Batch claim revenue across all assets where user has claimable amounts
 */
export function useBatchClaimRevenue() {
  const queryClient = useQueryClient();
  const { signer } = useContext(WalletContext);

  return useMutation({
    mutationFn: async ({ assetIds, properties: propsList }) => {
      if (!signer) throw new Error("Wallet not connected");

      const address = CONTRACT_ADDRESSES.REVENUE_DISTRIBUTOR;
      if (!address)
        throw new Error("RevenueDistributor contract address not configured");

      const contract = new ethers.Contract(
        address,
        CONTRACT_ABIS.REVENUE_DISTRIBUTOR,
        signer,
      );

      toast.loading(`Claiming from ${assetIds.length} properties...`, {
        id: "batch-claim",
      });

      const tx = await contract.batchClaimRevenue(assetIds.map(BigInt));
      const receipt = await tx.wait();

      toast.success("Batch claim successful!", { id: "batch-claim" });

      // Record each claim in backend
      for (const prop of propsList) {
        await revenueService.recordClaim({
          propertyId: prop.propertyId,
          assetId: prop.assetId,
          amountEth: prop.claimableEth,
          txHash: receipt.hash,
        });
      }

      return { txHash: receipt.hash };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REVENUE_KEYS.claimable });
      queryClient.invalidateQueries({ queryKey: REVENUE_KEYS.history });
    },
    onError: (error) => {
      toast.dismiss("batch-claim");
      toast.error(error?.reason || error?.message || "Batch claim failed");
    },
  });
}

// ─── Admin Hooks ──────────────────────────────────────────────────────────────

/**
 * Fetch all distributions (admin)
 */
export function useAdminDistributions() {
  return useQuery({
    queryKey: REVENUE_KEYS.adminDistributions,
    queryFn: () => revenueService.getAllDistributions(),
    staleTime: 1000 * 60,
    select: (data) => data?.data || [],
  });
}

/**
 * Fetch tokenized properties with blockchain revenue info (admin)
 */
export function useAdminRevenueProperties() {
  return useQuery({
    queryKey: REVENUE_KEYS.adminProperties,
    queryFn: () => revenueService.getTokenizedPropertiesForRevenue(),
    staleTime: 1000 * 60,
    select: (data) => data?.data || [],
  });
}

/**
 * Revenue history for a specific property (admin)
 */
export function usePropertyRevenueHistory(propertyId) {
  return useQuery({
    queryKey: REVENUE_KEYS.propertyHistory(propertyId),
    queryFn: () => revenueService.getPropertyRevenueHistory(propertyId),
    enabled: !!propertyId,
    staleTime: 1000 * 60,
    select: (data) => data?.data || [],
  });
}

/**
 * Admin: deposit revenue for a property
 */
export function useDepositRevenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, amountEth, notes }) =>
      revenueService.depositRevenue({ propertyId, amountEth, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REVENUE_KEYS.adminProperties });
      queryClient.invalidateQueries({
        queryKey: REVENUE_KEYS.adminDistributions,
      });
      toast.success("Revenue deposited successfully!");
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          "Failed to deposit revenue",
      );
    },
  });
}
