import React, { useMemo } from "react";

/**
 * Page Header Component
 * Displays page title and optional right-aligned header content
 */
const PageHeader = ({ title, rightHeaderContent }) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
    {title && (
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
    )}
    {rightHeaderContent && (
      <div className="w-full sm:w-auto flex-shrink-0">{rightHeaderContent}</div>
    )}
  </div>
);

/**
 * Page Content Component
 * Wrapper for main page content
 */
const PageContent = ({ children }) => (
  <div className="space-y-6">{children}</div>
);

/**
 * PageContainer Component
 * Layout wrapper for dashboard and admin pages.
 * Provides consistent spacing, typography, and structure.
 *
 * Props:
 * @param {string} title - Optional page title displayed in header
 * @param {React.ReactNode} children - Main page content
 * @param {React.ReactNode} rightHeaderContent - Optional content aligned to the right of header
 *
 * Features:
 * - Responsive container with optimized padding
 * - Consistent spacing and typography
 * - Flexible header layout with title and actions
 * - Professional styling with design system colors
 * - Performance optimized with memoization
 *
 * @returns {React.ReactElement} Rendered page container
 */
export const PageContainer = ({ title, children, rightHeaderContent }) => {
  // Memoize header to prevent unnecessary re-renders
  const header = useMemo(
    () => <PageHeader title={title} rightHeaderContent={rightHeaderContent} />,
    [title, rightHeaderContent]
  );

  // Memoize content to prevent unnecessary re-renders
  const content = useMemo(
    () => <PageContent children={children} />,
    [children]
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
      {header}
      {content}
    </div>
  );
};

export default PageContainer;
