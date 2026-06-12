import { useAuth as useAuthContext } from "@/contexts/AuthContext";
import { authService } from "@/services/auth.service";
import { useMutation, useQuery } from "@tanstack/react-query";

/**
 * useAuth Hook
 * Provides authentication methods and state
 */
export function useAuth() {
  const { setUser, user } = useAuthContext();

  /**
   * Signup mutation
   */
  const signupMutation = useMutation({
    mutationFn: (data) => authService.signup(data),
    onSuccess: (data) => {
      setUser(data.user);
    },
  });

  /**
   * Login mutation
   */
  const loginMutation = useMutation({
    mutationFn: ({ email, password }) => authService.login(email, password),
    onSuccess: (data) => {
      setUser(data.user);
    },
  });

  /**
   * Logout mutation
   */
  const logoutMutation = useMutation({
    mutationFn: () => {
      authService.logout();
      setUser(null);
    },
  });

  /**
   * Get current user query
   */
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authService.getCurrentUser(),
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: false,
  });

  return {
    user: user || currentUser,
    isLoading,
    signup: signupMutation,
    login: loginMutation,
    logout: logoutMutation,
  };
}
