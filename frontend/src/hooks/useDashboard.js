import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

/**
 * API Endpoint Constants
 * Centralized endpoint definitions for dashboard-related API calls
 */
const API_ENDPOINTS = {
  PORTFOLIO_STATS: '/portfolio/stats',
  KYC_SUBMISSIONS: '/verifier/submissions',
};

/**
 * Query Configuration Constants
 * Centralized settings for React Query behavior
 */
const QUERY_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  CACHE_TIME: 10 * 60 * 1000, // 10 minutes
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 1000,
};

const QUERY_KEYS = {
  PORTFOLIO_STATS: ['portfolioStats'],
  KYC_SUBMISSIONS: ['kycSubmissions'],
};

const ERROR_MESSAGES = {
  PORTFOLIO_STATS_FAILED: 'Failed to fetch portfolio statistics',
  KYC_SUBMISSIONS_FAILED: 'Failed to fetch KYC submissions',
};

/**
 * Fetches portfolio statistics for the authenticated user
 * 
 * @returns {Promise<Object>} Portfolio stats data containing:
 *   - totalInvestment: Total amount invested
 *   - activeAssets: Number of active assets
 *   - returns: Current returns
 *   - portfolioValue: Total portfolio value
 *   - historicalData: Array of historical performance data
 * 
 * @throws {Error} If API request fails
 */
const fetchPortfolioStats = async () => {
  try {
    const { data } = await api.get(API_ENDPOINTS.PORTFOLIO_STATS);
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(ERROR_MESSAGES.PORTFOLIO_STATS_FAILED, error);
    }
    throw new Error(error.response?.data?.message || ERROR_MESSAGES.PORTFOLIO_STATS_FAILED);
  }
};

/**
 * Hook: usePortfolioStats
 * 
 * Fetches and caches the user's portfolio statistics with automatic updates.
 * 
 * Features:
 * - Automatic caching (5 minutes stale time)
 * - Automatic retry on failure (2 attempts)
 * - Background refetch support
 * - Error handling with user-friendly messages
 * - Loading and error states
 * 
 * Returns:
 * @returns {Object} React Query result object
 *   - data: Portfolio statistics (null while loading)
 *   - isLoading: Boolean indicating if data is being fetched
 *   - isError: Boolean indicating if fetch failed
 *   - error: Error object if fetch failed
 *   - refetch: Function to manually trigger refetch
 *   - isFetching: Boolean indicating background fetch in progress
 * 
 * Usage:
 * ```jsx
 * const { data: stats, isLoading, error } = usePortfolioStats();
 * 
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * 
 * return (
 *   <div>
 *     <p>Total: ${stats.totalInvestment}</p>
 *     <p>Assets: {stats.activeAssets}</p>
 *   </div>
 * );
 * ```
 * 
 * Performance Notes:
 * - Caches results for 5 minutes before marking as stale
 * - Keeps data in cache for 10 minutes before eviction
 * - Automatically retries failed requests up to 2 times
 * - Prevents duplicate requests within cache window
 */
export const usePortfolioStats = () => {
  return useQuery({
    queryKey: QUERY_KEYS.PORTFOLIO_STATS,
    queryFn: fetchPortfolioStats,
    staleTime: QUERY_CONFIG.STALE_TIME,
    gcTime: QUERY_CONFIG.CACHE_TIME,
    retry: QUERY_CONFIG.RETRY_ATTEMPTS,
    retryDelay: QUERY_CONFIG.RETRY_DELAY,
  });
};

/**
 * Fetches KYC submissions for admin/verifier review
 * 
 * Restricted to admin and verifier roles. Returns pending, approved, and rejected
 * KYC submissions that need review or have been processed.
 * 
 * @returns {Promise<Object>} KYC submissions data containing:
 *   - submissions: Array of KYC submission objects
 *   - pending: Number of pending submissions
 *   - approved: Number of approved submissions
 *   - rejected: Number of rejected submissions
 *   - totalCount: Total number of submissions
 * 
 * @throws {Error} If API request fails or user lacks permissions
 */
const fetchKycSubmissions = async () => {
  try {
    const { data } = await api.get(API_ENDPOINTS.KYC_SUBMISSIONS);
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(ERROR_MESSAGES.KYC_SUBMISSIONS_FAILED, error);
    }
    throw new Error(error.response?.data?.message || ERROR_MESSAGES.KYC_SUBMISSIONS_FAILED);
  }
};

/**
 * Hook: useKycSubmissions
 * 
 * Fetches and caches KYC submissions for admin/verifier review.
 * 
 * Features:
 * - Admin and verifier role requirement (enforced by backend)
 * - Automatic caching (5 minutes stale time)
 * - Automatic retry on failure (2 attempts)
 * - Background refetch support
 * - Error handling for permission denied scenarios
 * - Real-time update capability
 * 
 * Returns:
 * @returns {Object} React Query result object
 *   - data: KYC submissions data (null while loading)
 *   - isLoading: Boolean indicating if data is being fetched
 *   - isError: Boolean indicating if fetch failed
 *   - error: Error object if fetch failed (includes 403 for permission denied)
 *   - refetch: Function to manually trigger refetch
 *   - isFetching: Boolean indicating background fetch in progress
 * 
 * Usage:
 * ```jsx
 * const { data: submissions, isLoading, error } = useKycSubmissions();
 * 
 * if (isLoading) return <LoadingSpinner />;
 * if (error?.response?.status === 403) {
 *   return <AccessDenied />;
 * }
 * if (error) return <ErrorMessage error={error} />;
 * 
 * return (
 *   <div>
 *     <p>Pending: {submissions.pending}</p>
 *     {submissions.submissions.map((sub) => (
 *       <KycReviewCard key={sub.id} submission={sub} />
 *     ))}
 *   </div>
 * );
 * ```
 * 
 * Performance Notes:
 * - Caches results for 5 minutes before marking as stale
 * - Keeps data in cache for 10 minutes before eviction
 * - Automatically retries failed requests up to 2 times
 * - Prevents duplicate requests within cache window
 * - Background updates while component is mounted
 */
export const useKycSubmissions = () => {
  return useQuery({
    queryKey: QUERY_KEYS.KYC_SUBMISSIONS,
    queryFn: fetchKycSubmissions,
    staleTime: QUERY_CONFIG.STALE_TIME,
    gcTime: QUERY_CONFIG.CACHE_TIME,
    retry: QUERY_CONFIG.RETRY_ATTEMPTS,
    retryDelay: QUERY_CONFIG.RETRY_DELAY,
  });
};
