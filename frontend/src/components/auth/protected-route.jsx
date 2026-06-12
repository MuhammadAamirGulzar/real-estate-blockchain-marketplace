import { Navigate, Outlet } from "react-router-dom";

/**
 * ProtectedRoute Component
 *
 * Route guard that checks if user is authenticated before allowing access.
 * Redirects to login page if user is not authenticated.
 * Gets auth token from localStorage.
 *
 * Usage:
 * <Route element={<ProtectedRoute />}>
 *   <Route path="/dashboard" element={<DashboardPage />} />
 * </Route>
 *
 * @returns {JSX.Element} Outlet for protected routes or redirect to login
 */
export function ProtectedRoute() {
  const token =
    localStorage.getItem("authToken") || localStorage.getItem("token");
  const user = localStorage.getItem("user") || localStorage.getItem("rwa_user");

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
