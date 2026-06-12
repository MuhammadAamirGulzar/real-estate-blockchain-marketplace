import { queryClient } from "@/main";
import { investmentService } from "@/services/investment.service";
import { useMutation, useQuery } from "@tanstack/react-query";

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeInvestmentAmounts = (items) =>
  (Array.isArray(items) ? items : []).map((investment) => {
    const fiatAmount = toPositiveNumber(investment?.fiatAmount);
    if (fiatAmount !== null) {
      return investment;
    }

    // Crypto rows can have fiatAmount unset; fall back to RWAP paid (1:1 display in UI).
    const rwaPaid = toPositiveNumber(investment?.amountPaidRwaToken);
    if (rwaPaid !== null) {
      return {
        ...investment,
        fiatAmount: rwaPaid.toFixed(2),
      };
    }

    return investment;
  });

/**
 * useInvestments Hook
 * Fetches user investments
 */
export function useInvestments() {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["investments"],
    queryFn: () => investmentService.getUserInvestments(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    investments: normalizeInvestmentAmounts(
      Array.isArray(data)
        ? data
        : Array.isArray(data?.investments)
          ? data.investments
          : [],
    ),
    loading: isLoading,
    error: error ? formatError(error) : null,
  };
}

/**
 * useCreateInvestment Hook
 * Creates new investment
 */
export function useCreateInvestment() {
  return useMutation({
    mutationFn: (data) => investmentService.createInvestment(data),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}

/**
 * Helper function to format errors
 */
function formatError(error) {
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  return "An error occurred";
}
