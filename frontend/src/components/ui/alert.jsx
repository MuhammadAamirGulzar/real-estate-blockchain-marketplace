import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import * as React from "react";

/**
 * Alert component variants using CVA
 * Supports default and destructive states
 * Includes icon positioning and styling
 */
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        destructive:
          "border-destructive/50 bg-destructive/5 text-destructive [&>svg]:text-destructive",
        warning:
          "border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning",
        success:
          "border-success/40 bg-success/10 text-foreground [&>svg]:text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Alert Component
 * Base alert container with icon support and variant styling.
 *
 * Features:
 * - Multiple variants (default, destructive, warning, success)
 * - Icon positioning support
 * - Proper color scheme integration
 * - Semantic HTML with role="alert"
 * - Forwarded ref support
 * - Type-safe variant selection
 *
 * @param {string} className - Additional CSS classes
 * @param {string} variant - Alert variant ('default' | 'destructive' | 'warning' | 'success')
 * @param {any} props - Additional component props
 * @param {React.Ref} ref - Forwarded ref
 *
 * @example
 * <Alert variant="destructive">
 *   <AlertTitle>Error</AlertTitle>
 *   <AlertDescription>Something went wrong</AlertDescription>
 * </Alert>
 *
 * @returns {React.ReactElement} Rendered alert component
 */
const Alert = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));

Alert.displayName = "Alert";

/**
 * AlertTitle Component
 * Semantic heading for alert content.
 *
 * Features:
 * - Proper typography and spacing
 * - Bold heading style
 * - Consistent font sizing
 * - Forwarded ref support
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 * @param {React.Ref} ref - Forwarded ref
 *
 * @example
 * <AlertTitle>Attention Required</AlertTitle>
 *
 * @returns {React.ReactElement} Rendered alert title
 */
const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));

AlertTitle.displayName = "AlertTitle";

/**
 * AlertDescription Component
 * Secondary text content for alert details.
 *
 * Features:
 * - Proper text sizing and spacing
 * - Better readability for paragraphs
 * - Consistent styling
 * - Forwarded ref support
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 * @param {React.Ref} ref - Forwarded ref
 *
 * @example
 * <AlertDescription>This is the alert message content</AlertDescription>
 *
 * @returns {React.ReactElement} Rendered alert description
 */
const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));

AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription, AlertTitle, alertVariants };
