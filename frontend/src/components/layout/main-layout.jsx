import { Suspense, lazy, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

// Lazy-load components
const Header = lazy(() => import("@/components/layout/Header"));
const Footer = lazy(() => import("@/components/landing/footer").then((m) => ({ default: m.Footer })));

function MainLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground theme-transition">
      {/* Header rendered once */}
      <Suspense
        fallback={
          <div className="w-full h-16 border-b bg-card border-border" />
        }
      >
        <Header />
      </Suspense>

      {/* Page content */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Footer rendered once */}
      <Suspense
        fallback={
          <div className="w-full h-24 border-t bg-background border-border" />
        }
      >
        <Footer />
      </Suspense>
    </div>
  );
}

export default MainLayout;
