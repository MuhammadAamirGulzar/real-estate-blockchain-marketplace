import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Dialog Root Component
 * Base dialog container from Radix UI primitives.
 */
const Dialog = DialogPrimitive.Root;

/**
 * DialogTrigger Component
 * Element that triggers dialog opening.
 */
const DialogTrigger = DialogPrimitive.Trigger;

/**
 * DialogPortal Component
 * Portal container for rendering dialog outside DOM hierarchy.
 */
const DialogPortal = DialogPrimitive.Portal;

/**
 * DialogClose Component
 * Closes the dialog when clicked.
 */
const DialogClose = DialogPrimitive.Close;

/**
 * DialogOverlay Component
 * Backdrop overlay behind the dialog content.
 *
 * Features:
 * - Full screen coverage with fixed positioning
 * - Semi-transparent dark background (80% black)
 * - Smooth fade animations
 * - Proper z-index layering
 * - Customizable via className prop
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 * @param {React.Ref} ref - Forwarded ref
 *
 * @returns {React.ReactElement} Rendered dialog overlay
 */
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * DialogContent Component
 * Main dialog container with content, close button, and animations.
 *
 * Features:
 * - Centered positioning with transform
 * - Smooth scale and slide animations
 * - Close button with accessibility
 * - Responsive design (rounded on sm and up)
 * - Proper shadow and border styling
 * - Customizable via className prop
 * - Includes screen reader close button
 *
 * @param {string} className - Additional CSS classes
 * @param {React.ReactNode} children - Dialog content
 * @param {any} props - Additional component props
 * @param {React.Ref} ref - Forwarded ref
 *
 * @returns {React.ReactElement} Rendered dialog content
 */
const DialogContent = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 rounded-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 opacity-70 ring-offset-background transition-all duration-200 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-muted data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * DialogHeader Component
 * Top section of dialog for title and description.
 *
 * Features:
 * - Flex column layout
 * - Centered text on mobile, left-aligned on desktop
 * - Proper spacing between children
 * - Customizable via className prop
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dialog header
 */
const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

/**
 * DialogFooter Component
 * Bottom section of dialog for action buttons.
 *
 * Features:
 * - Flex layout with reverse column on mobile
 * - Row with proper spacing on desktop
 * - Right-aligned buttons on desktop
 * - Stacked buttons on mobile
 * - Customizable via className prop
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dialog footer
 */
const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

/**
 * DialogTitle Component
 * Main heading for dialog content.
 *
 * Features:
 * - Semantic HTML (h2 tag)
 * - Large, semibold typography
 * - Consistent line height and tracking
 * - Proper text color
 * - Full ref forwarding support
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 * @param {React.Ref} ref - Forwarded ref
 *
 * @returns {React.ReactElement} Rendered dialog title
 */
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-foreground",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

/**
 * DialogDescription Component
 * Secondary text for additional context in dialog.
 *
 * Features:
 * - Radix semantic description with a block-safe wrapper
 * - Smaller font size
 * - Muted text color for hierarchy
 * - Consistent with design system
 * - Full ref forwarding support
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 * @param {React.Ref} ref - Forwarded ref
 *
 * @returns {React.ReactElement} Rendered dialog description
 */
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description asChild>
    <div
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  </DialogPrimitive.Description>
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
