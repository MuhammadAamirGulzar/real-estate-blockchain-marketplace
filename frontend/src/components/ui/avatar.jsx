"use client";

import { cn } from "@/lib/utils";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";

/**
 * Avatar Component
 * Root container for avatar display with image and fallback support.
 *
 * Features:
 * - Circular design with consistent sizing
 * - Responsive sizing (default: 8 units)
 * - Overflow hidden for proper circular display
 * - Built on Radix UI for accessibility
 * - Customizable via className prop
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 *
 * @example
 * <Avatar>
 *   <AvatarImage src="https://example.com/avatar.jpg" alt="User" />
 *   <AvatarFallback>JD</AvatarFallback>
 * </Avatar>
 *
 * @returns {React.ReactElement} Rendered avatar root
 */
const Avatar = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    data-slot="avatar"
    className={cn(
      "relative inline-flex size-8 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-border/20 transition-all duration-200",
      className
    )}
    {...props}
  />
));

Avatar.displayName = "Avatar";

/**
 * AvatarImage Component
 * Image element within avatar that displays user avatar.
 * Falls back to AvatarFallback if image fails to load.
 *
 * Features:
 * - Proper aspect ratio (square)
 * - Full size coverage
 * - Lazy loading support
 * - Smooth image transitions
 * - Error handling via fallback
 *
 * @param {string} className - Additional CSS classes
 * @param {string} src - Image source URL
 * @param {string} alt - Image alt text
 * @param {any} props - Additional component props
 *
 * @example
 * <AvatarImage src="https://example.com/avatar.jpg" alt="John Doe" />
 *
 * @returns {React.ReactElement} Rendered avatar image
 */
const AvatarImage = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    data-slot="avatar-image"
    className={cn(
      "aspect-square size-full object-cover transition-opacity duration-200",
      className
    )}
    {...props}
  />
));

AvatarImage.displayName = "AvatarImage";

/**
 * AvatarFallback Component
 * Fallback content displayed when avatar image fails or is not available.
 * Typically displays user initials or placeholder icon.
 *
 * Features:
 * - Centered text display
 * - Professional background color (muted)
 * - Proper sizing and spacing
 * - Accessible typography
 * - Smooth transitions
 *
 * @param {string} className - Additional CSS classes
 * @param {React.ReactNode} children - Fallback content (initials, icon, etc.)
 * @param {any} props - Additional component props
 *
 * @example
 * <AvatarFallback>JD</AvatarFallback>
 * <AvatarFallback><UserIcon className="w-4 h-4" /></AvatarFallback>
 *
 * @returns {React.ReactElement} Rendered avatar fallback
 */
const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    data-slot="avatar-fallback"
    className={cn(
      "flex size-full items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/80 text-sm font-semibold text-muted-foreground transition-all duration-200",
      className
    )}
    {...props}
  />
));

AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarFallback, AvatarImage };
