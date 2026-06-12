import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

const ROLE_REDIRECT_MAP = {
  admin: "/admin",
  subadmin: "/admin",
  verifier: "/verifier/dashboard",
  user: "/user/dashboard",
};

const DEFAULT_REDIRECT_PATH = "/user/dashboard";
const DEFAULT_FALLBACK_PATH = "/login";

const LoadingState = () => (
  <div className="flex items-center justify-center w-screen min-h-screen bg-gradient-to-br from-background to-muted">
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative w-12 h-12">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium text-foreground">
          Loading your wallet
        </p>
        <p className="text-xs text-muted-foreground">
          Please wait while we authenticate your session...
        </p>
      </div>
    </div>
  </div>
);

const getRoleRedirectPath = (role) => {
  return ROLE_REDIRECT_MAP[role] || DEFAULT_REDIRECT_PATH;
};

export function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 mx-auto border-4 rounded-full border-primary border-t-transparent animate-spin"></div>
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Auto-redirect based on user role if accessing generic dashboard
  if (isAuthenticated && user && location.pathname === "/dashboard") {
    const redirectPath = getRoleRedirectPath(user.role);
    return <Navigate to={redirectPath} replace />;
  }

  // Check role-based access if required - support single role or array of roles
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole)
      ? requiredRole
      : [requiredRole];
    const hasAccess = allowedRoles.includes(user?.role);

    if (!hasAccess) {
      return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-background">
          <div className="w-full max-w-md p-8 text-center border rounded-lg bg-card border-border">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10">
              <svg
                className="w-8 h-8 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              Access Denied
            </h2>
            <p className="mb-6 text-muted-foreground">
              You don't have permission to access this page. Required role:{" "}
              {Array.isArray(requiredRole)
                ? requiredRole.join(" or ")
                : requiredRole}
            </p>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 transition-colors rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  // Render children if authenticated and authorized
  return <>{children}</>;
}

export default ProtectedRoute;
