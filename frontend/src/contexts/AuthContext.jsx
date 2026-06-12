import api from "@/services/api";
import { authService } from "@/services/auth.service";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const storedUser = localStorage.getItem("user");

        if (token && storedUser) {
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);

          try {
            const currentUser = await authService.getCurrentUser();
            setUser(currentUser);
            localStorage.setItem("user", JSON.stringify(currentUser));
          } catch (err) {
            authService.logout();
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const signup = useCallback(async (email, password, firstName, lastName) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.signup(
        email,
        password,
        firstName,
        lastName,
      );
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (err) {
      const errorMessage = err.message || "Registration failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);

      // Return the response so the calling component can handle redirect
      return response;
    } catch (err) {
      const errorMessage = err.message || "Login failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectWallet = useCallback(
    async (walletAddress, signature, message) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authService.connectWallet(
          walletAddress,
          signature,
          message,
        );
        setUser(response.user);
        return response;
      } catch (err) {
        const errorMessage = err.message || "Wallet connection failed";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const loginWithWallet = useCallback(
    async (walletAddress, signature, message) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authService.verifyWallet(
          walletAddress,
          signature,
          message,
        );
        setUser(response.user);
        setIsAuthenticated(true);
        return response;
      } catch (err) {
        const errorMessage = err.message || "Wallet authentication failed";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      // Clear local storage first to prevent any state inconsistencies
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");

      // Call backend logout endpoint (fire and forget, don't await)
      api.post("/auth/logout").catch((err) => {
        console.error("Logout API error (non-critical):", err);
      });

      // Show notification
      toast.success("Logged out successfully");

      // Reset auth state
      setUser(null);
      setIsAuthenticated(false);

      // Redirect to login after a brief delay to allow state cleanup
      setTimeout(() => {
        window.location.href = "/login";
      }, 100);
    } catch (error) {
      console.error("Logout error:", error);
      // Even if there's an error, redirect to login
      window.location.href = "/login";
    }
  }, []);

  const updateUserRole = useCallback(
    (newRole) => {
      if (user) {
        const updatedUser = { ...user, role: newRole };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
    },
    [user],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const updateUserData = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      localStorage.setItem("user", JSON.stringify(currentUser));
      return currentUser;
    } catch (err) {
      console.error("Failed to update user data:", err);
      return null;
    }
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    signup,
    login,
    connectWallet,
    loginWithWallet,
    logout,
    clearError,
    setUser,
    updateUserData,
    updateUserRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
