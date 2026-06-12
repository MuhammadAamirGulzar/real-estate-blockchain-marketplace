import ErrorBoundary from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import MainLayout from "@/components/layout/main-layout";
import { ThemeProvider } from "@/components/theme-provider";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

const HomePage = lazy(() => import("@/pages/HomePage"));
const MarketplacePage = lazy(() => import("@/pages/MarketplacePage"));
const PropertyDetailsPage = lazy(() => import("@/pages/PropertyDetailsPage"));
const HowItWorksPage = lazy(() => import("@/pages/HowItWorksPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const DocumentationPage = lazy(() => import("@/pages/DocumentationPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("@/pages/TermsOfServicePage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PortfolioPage = lazy(() => import("@/pages/PortfolioPage"));
const KYCPage = lazy(() => import("@/pages/KYCPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const VerifierDashboard = lazy(
  () => import("@/pages/Verifier/VerifierDashboard"),
);
const AdminDashboard = lazy(() => import("@/pages/Admin/AdminDashboard"));
const SubAdminDashboard = lazy(
  () => import("@/pages/SubAdmin/SubAdminDashboard"),
);
const UserDashboard = lazy(() => import("@/pages/User/UserDashboard"));
const PropertySubmission = lazy(
  () => import("@/pages/User/PropertySubmission"),
);
const AdminDashboardPage = lazy(
  () => import("@/pages/Admin/AdminDashboardPage"),
);
const AdminAssetsPage = lazy(() => import("@/pages/Admin/AdminAssetsPage"));
const AdminInvestorsPage = lazy(
  () => import("@/pages/Admin/AdminInvestorsPage"),
);
const AdminKycReviewPage = lazy(
  () => import("@/pages/Admin/AdminKycReviewPage"),
);
const AdminCompliancePage = lazy(
  () => import("@/pages/Admin/AdminCompliancePage"),
);
const AdminTokenizationPage = lazy(
  () => import("@/pages/Admin/AdminTokenizationPage"),
);
const AdminInvestmentPoolsPage = lazy(
  () => import("@/pages/Admin/AdminInvestmentPoolsPage"),
);
const AdminPaymentVerificationPage = lazy(
  () => import("@/pages/Admin/AdminPaymentVerificationPage"),
);
const AdminRevenueDepositPage = lazy(
  () => import("@/pages/Admin/AdminRevenueDepositPage"),
);
const TradingPage = lazy(() => import("@/pages/TradingPage"));
const ReconciliationDashboard = lazy(
  () => import("@/pages/ReconciliationDashboard"),
);

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="space-y-4 text-center">
      <div className="w-16 h-16 mx-auto border-4 rounded-full border-primary border-t-transparent animate-spin"></div>
      <p className="text-muted-foreground animate-pulse">Loading...</p>
    </div>
  </div>
);

function AppRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<PageLoader />}>
      <div key={location.pathname} className="route-transition">
        <Routes location={location}>
          {/* Public Routes with Header/Footer */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/property/:id" element={<PropertyDetailsPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/documentation" element={<DocumentationPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          </Route>

          {/* Auth Routes (No Header/Footer) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected User Routes */}
          <Route
            path="/dashboard"
            element={<Navigate to="/user/dashboard" replace />}
          />
          <Route
            path="/portfolio"
            element={
              <ProtectedRoute>
                <PortfolioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trading/:propertyId"
            element={
              <ProtectedRoute>
                <TradingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kyc"
            element={
              <ProtectedRoute>
                <KYCPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Protected Verifier Routes */}
          <Route
            path="/verifier/dashboard"
            element={
              <ProtectedRoute requiredRole="verifier">
                <VerifierDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verifier/properties"
            element={
              <ProtectedRoute requiredRole="verifier">
                <VerifierDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole={["admin", "subadmin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole={["admin", "subadmin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assets"
            element={
              <ProtectedRoute requiredRole={["admin", "subadmin"]}>
                <AdminAssetsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/investors"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminInvestorsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/kyc-review"
            element={
              <ProtectedRoute requiredRole={["admin", "subadmin"]}>
                <AdminKycReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/compliance"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminCompliancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tokenization"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminTokenizationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/investment-pools"
            element={
              <ProtectedRoute requiredRole={["admin", "subadmin"]}>
                <AdminInvestmentPoolsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payment-verification"
            element={
              <ProtectedRoute requiredRole={["admin", "subadmin"]}>
                <AdminPaymentVerificationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/revenue"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminRevenueDepositPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reconciliation"
            element={
              <ProtectedRoute requiredRole="admin">
                <ReconciliationDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected SubAdmin Routes */}
          <Route
            path="/subadmin"
            element={
              <ProtectedRoute requiredRole="subadmin">
                <SubAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subadmin/dashboard"
            element={
              <ProtectedRoute requiredRole="subadmin">
                <SubAdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected User Dashboard Routes */}
          <Route
            path="/user"
            element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/dashboard"
            element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/property-submission"
            element={
              <ProtectedRoute>
                <PropertySubmission />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <div className="min-h-screen bg-background text-foreground theme-transition">
          <Toaster position="top-right" richColors />
          <AppRoutes />
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
