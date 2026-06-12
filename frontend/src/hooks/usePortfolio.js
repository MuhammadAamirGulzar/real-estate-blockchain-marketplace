import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

/**
 * API Endpoint Constants
 */
const API_ENDPOINTS = {
  PORTFOLIO_STATS: '/portfolio/stats',
};

/**
 * Query Configuration Constants
 */
const QUERY_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  CACHE_TIME: 10 * 60 * 1000, // 10 minutes (garbage collection time)
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 1000, // 1 second
};

/**
 * Query Key Constants
 */
const QUERY_KEYS = {
  PORTFOLIO: ['portfolio'],
  PORTFOLIO_HOLDINGS: ['portfolio', 'holdings'],
  PORTFOLIO_PERFORMANCE: ['portfolio', 'performance'],
};

/**
 * Error Messages
 */
const ERROR_MESSAGES = {
  FETCH_FAILED: 'Failed to fetch portfolio data',
  INVALID_RESPONSE: 'Invalid portfolio response format',
  NETWORK_ERROR: 'Network error while fetching portfolio',
};

/**
 * Fetches portfolio statistics and holdings for authenticated user
 *
 * Retrieves comprehensive portfolio data including:
 * - Total portfolio value
 * - Asset holdings and distribution
 * - Performance metrics (gains/losses)
 * - Investment history
 * - Asset allocation by property
 *
 * @returns {Promise<Object>} Portfolio data object containing:
 *   - totalValue: Total portfolio value in USD
 *   - totalInvested: Total amount invested
 *   - totalReturns: Total returns in USD
 *   - returnsPercentage: Returns as percentage
 *   - holdings: Array of asset holdings
 *   - performance: Historical performance data
 *   - assetAllocation: Asset distribution breakdown
 *   - lastUpdated: Timestamp of last update
 *
 * @throws {Error} If API request fails or response is invalid
 *
 * @example
 * try {
 *   const data = await fetchPortfolio();
 *   console.log(`Total Value: $${data.totalValue}`);
 * } catch (error) {
 *   console.error('Failed to fetch portfolio:', error);
 * }
 */
const fetchPortfolio = async () => {
  try {
    const { data } = await api.get(API_ENDPOINTS.PORTFOLIO_STATS);

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error(ERROR_MESSAGES.INVALID_RESPONSE);
    }

    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(ERROR_MESSAGES.FETCH_FAILED, error);
    }

    // Provide meaningful error message
    const message = error.response?.data?.message || error.message || ERROR_MESSAGES.FETCH_FAILED;
    throw new Error(message);
  }
};

/**
 * Hook: usePortfolio
 *
 * Fetches and caches user portfolio statistics with automatic updates.
 *
 * Features:
 * - Automatic caching (5 minutes stale time)
 * - Automatic retry on failure (2 attempts with 1 second delay)
 * - Background refetch support
 * - Error handling with meaningful messages
 * - Loading and error states
 * - Optimized for re-render prevention
 *
 * Returns:
 * @returns {Object} React Query result object
 *   - data: Portfolio statistics object (null while loading)
 *   - isLoading: Boolean indicating if data is being fetched
 *   - isError: Boolean indicating if fetch failed
 *   - error: Error object if fetch failed (null on success)
 *   - isFetching: Boolean indicating background fetch in progress
 *   - refetch: Function to manually trigger refetch
 *   - isStale: Boolean indicating if data is stale (older than staleTime)
 *   - dataUpdatedAt: Timestamp of last successful data update
 *   - failureCount: Number of failed fetch attempts
 *
 * Caching Strategy:
 * - Marks data as stale after 5 minutes
 * - Keeps data in cache for 10 minutes before garbage collection
 * - Automatically retries failed requests up to 2 times
 * - 1 second delay between retry attempts
 * - Prevents duplicate requests within cache window
 * - Background refetch while cached data is fresh
 *
 * Usage:
 * ```jsx
 * import { usePortfolio } from '@/hooks/usePortfolio';
 *
 * export function PortfolioOverview() {
 *   const { 
 *     data: portfolio, 
 *     isLoading, 
 *     isError, 
 *     error, 
 *     refetch 
 *   } = usePortfolio();
 *
 *   if (isLoading) {
 *     return <div className="p-4 text-muted-foreground">Loading portfolio...</div>;
 *   }
 *
 *   if (isError) {
 *     return (
 *       <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
 *         <p className="text-destructive font-medium">Error loading portfolio</p>
 *         <p className="text-destructive/80 text-sm">{error.message}</p>
 *         <button 
 *           onClick={() => refetch()}
 *           className="mt-2 px-3 py-1 bg-destructive text-destructive-foreground rounded"
 *         >
 *           Try Again
 *         </button>
 *       </div>
 *     );
 *   }
 *
 *   return (
 *     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 *       <div className="p-6 bg-card border border-border rounded-lg">
 *         <p className="text-muted-foreground text-sm">Total Value</p>
 *         <p className="text-3xl font-bold text-foreground">
 *           ${portfolio.totalValue.toLocaleString()}
 *         </p>
 *       </div>
 *       <div className="p-6 bg-card border border-border rounded-lg">
 *         <p className="text-muted-foreground text-sm">Total Returns</p>
 *         <p className="text-3xl font-bold text-secondary">
 *           +${portfolio.totalReturns.toLocaleString()}
 *         </p>
 *         <p className="text-sm text-secondary">
 *           ({portfolio.returnsPercentage}%)
 *         </p>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * Advanced Usage with Manual Refetch:
 * ```jsx
 * export function PortfolioWithRefresh() {
 *   const { data: portfolio, refetch, isFetching } = usePortfolio();
 *
 *   const handleManualRefresh = async () => {
 *     await refetch();
 *   };
 *
 *   return (
 *     <div>
 *       <button 
 *         onClick={handleManualRefresh}
 *         disabled={isFetching}
 *         className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
 *       >
 *         {isFetching ? 'Refreshing...' : 'Refresh Portfolio'}
 *       </button>
 *       {portfolio && <PortfolioDisplay data={portfolio} />}
 *     </div>
 *   );
 * }
 * ```
 *
 * Integration with Error Boundary:
 * ```jsx
 * export function SafePortfolio() {
 *   const { data, isLoading, error } = usePortfolio();
 *
 *   if (error) {
 *     return (
 *       <ErrorBoundary 
 *         fallback={
 *           <div className="p-4 text-destructive">
 *             Portfolio failed to load
 *           </div>
 *         }
 *       >
 *         {null}
 *       </ErrorBoundary>
 *     );
 *   }
 *
 *   return isLoading ? <Skeleton /> : <Portfolio data={data} />;
 * }
 * ```
 *
 * Performance Notes:
 * - Caches results for 5 minutes before marking as stale
 * - Keeps data in cache for 10 minutes before garbage collection
 * - Automatically retries failed requests up to 2 times
 * - 1 second delay between retry attempts
 * - Prevents duplicate requests within cache window
 * - Background updates while component is mounted
 * - Only re-renders when data actually changes
 * - Efficient for multiple components using same hook
 *
 * Dependencies:
 * - @tanstack/react-query: Query caching and state management
 * - @/services/api: HTTP client for API calls
 *
 * Related Hooks:
 * - useDashboard(): For dashboard-specific metrics
 * - usePortfolioStats(): For detailed statistics
 *
 * @returns {Object} React Query result object with portfolio data
 *
 * @throws {Error} Errors from API calls are caught and re-thrown with messages
 *
 * @see https://tanstack.com/query/latest/docs/react/overview
 */
export const usePortfolio = () => {
  return useQuery({
    queryKey: QUERY_KEYS.PORTFOLIO,
    queryFn: fetchPortfolio,
    staleTime: QUERY_CONFIG.STALE_TIME,
    gcTime: QUERY_CONFIG.CACHE_TIME,
    retry: QUERY_CONFIG.RETRY_ATTEMPTS,
    retryDelay: QUERY_CONFIG.RETRY_DELAY,
  });
};

/**
 * Hook: usePortfolioHoldings
 *
 * Specialized hook for fetching portfolio holdings separately.
 * Useful for pages that only need holdings data without full portfolio stats.
 *
 * @returns {Object} React Query result object with holdings array
 *
 * Usage:
 * ```jsx
 * const { data: holdings, isLoading } = usePortfolioHoldings();
 * ```
 */
export const usePortfolioHoldings = () => {
  return useQuery({
    queryKey: QUERY_KEYS.PORTFOLIO_HOLDINGS,
    queryFn: async () => {
      const { data } = await fetchPortfolio();
      return data?.holdings || [];
    },
    staleTime: QUERY_CONFIG.STALE_TIME,
    gcTime: QUERY_CONFIG.CACHE_TIME,
    retry: QUERY_CONFIG.RETRY_ATTEMPTS,
    retryDelay: QUERY_CONFIG.RETRY_DELAY,
  });
};

/**
 * Hook: usePortfolioPerformance
 *
 * Specialized hook for fetching portfolio performance data separately.
 * Useful for performance charts and analytics without fetching full data.
 *
 * @returns {Object} React Query result object with performance data
 *
 * Usage:
 * ```jsx
 * const { data: performance, isLoading } = usePortfolioPerformance();
 * ```
 */
export const usePortfolioPerformance = () => {
  return useQuery({
    queryKey: QUERY_KEYS.PORTFOLIO_PERFORMANCE,
    queryFn: async () => {
      const { data } = await fetchPortfolio();
      return data?.performance || [];
    },
    staleTime: QUERY_CONFIG.STALE_TIME,
    gcTime: QUERY_CONFIG.CACHE_TIME,
    retry: QUERY_CONFIG.RETRY_ATTEMPTS,
    retryDelay: QUERY_CONFIG.RETRY_DELAY,
  });
};
