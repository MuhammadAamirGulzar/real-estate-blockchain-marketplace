"use client";

import { cn } from "@/lib/utils";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import * as React from "react";

/**
 * DropdownMenu Component
 * Root container for dropdown menu functionality.
 *
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu root
 */
const DropdownMenu = (props) => (
  <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
);

DropdownMenu.displayName = "DropdownMenu";

/**
 * DropdownMenuPortal Component
 * Portal container for rendering menu outside DOM hierarchy.
 *
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu portal
 */
const DropdownMenuPortal = (props) => (
  <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
);

DropdownMenuPortal.displayName = "DropdownMenuPortal";

/**
 * DropdownMenuTrigger Component
 * Element that triggers dropdown menu opening.
 *
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu trigger
 */
const DropdownMenuTrigger = (props) => (
  <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
);

DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

/**
 * DropdownMenuContent Component
 * Main content container for dropdown menu items.
 *
 * Features:
 * - Portal rendering for proper z-index
 * - Smooth fade and zoom animations
 * - Slide animations based on position
 * - Customizable side offset (default: 4px)
 * - Proper overflow handling
 * - Design system color integration
 *
 * @param {string} className - Additional CSS classes
 * @param {number} sideOffset - Distance from trigger (default: 4)
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu content
 */
const DropdownMenuContent = React.forwardRef(
  ({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-background text-foreground border border-border z-50 min-w-[8rem] max-h-[var(--radix-dropdown-menu-content-available-height)] origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-x-hidden overflow-y-auto rounded-lg p-1 shadow-lg transition-all duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
);

DropdownMenuContent.displayName = "DropdownMenuContent";

/**
 * DropdownMenuGroup Component
 * Wrapper for grouping related menu items.
 *
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu group
 */
const DropdownMenuGroup = (props) => (
  <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
);

DropdownMenuGroup.displayName = "DropdownMenuGroup";

/**
 * DropdownMenuItem Component
 * Individual menu item with optional inset and variant support.
 *
 * Features:
 * - Multiple variants (default, destructive)
 * - Inset option for nested items
 * - Smooth transitions and hover effects
 * - Icon support with automatic sizing
 * - Disabled state handling
 * - Keyboard navigation support
 *
 * @param {string} className - Additional CSS classes
 * @param {boolean} inset - Add left padding for nested items
 * @param {string} variant - Item variant ('default' | 'destructive')
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu item
 */
const DropdownMenuItem = React.forwardRef(
  ({ className, inset, variant = "default", ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        'relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-hidden select-none transition-colors duration-150 focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg:not([class*="text-"])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 hover:bg-muted/50',
        variant === "destructive" &&
          "text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive data-[destructive]:*:[svg]:!text-destructive",
        className
      )}
      {...props}
    />
  )
);

DropdownMenuItem.displayName = "DropdownMenuItem";

/**
 * DropdownMenuCheckboxItem Component
 * Menu item with checkbox indicator.
 *
 * Features:
 * - Checkbox indicator on the left
 * - Checked/unchecked states
 * - Smooth transitions
 * - Disabled state handling
 * - Icon support
 *
 * @param {string} className - Additional CSS classes
 * @param {React.ReactNode} children - Menu item content
 * @param {boolean} checked - Checkbox state
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu checkbox item
 */
const DropdownMenuCheckboxItem = React.forwardRef(
  ({ className, children, checked, ...props }, ref) => (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        'relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm font-medium outline-hidden select-none transition-colors duration-150 focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 hover:bg-muted/50',
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="h-4 w-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
);

DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

/**
 * DropdownMenuRadioGroup Component
 * Wrapper for grouping radio menu items.
 *
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu radio group
 */
const DropdownMenuRadioGroup = (props) => (
  <DropdownMenuPrimitive.RadioGroup
    data-slot="dropdown-menu-radio-group"
    {...props}
  />
);

DropdownMenuRadioGroup.displayName = "DropdownMenuRadioGroup";

/**
 * DropdownMenuRadioItem Component
 * Menu item with radio indicator for single selection.
 *
 * Features:
 * - Radio indicator on the left
 * - Single selection state
 * - Smooth transitions
 * - Disabled state handling
 * - Icon support
 *
 * @param {string} className - Additional CSS classes
 * @param {React.ReactNode} children - Menu item content
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu radio item
 */
const DropdownMenuRadioItem = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm font-medium outline-hidden select-none transition-colors duration-150 focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 hover:bg-muted/50',
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="h-2 w-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
);

DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

/**
 * DropdownMenuLabel Component
 * Non-interactive label for grouping menu items.
 *
 * Features:
 * - Smaller font size and weight
 * - Optional inset padding
 * - Muted color
 *
 * @param {string} className - Additional CSS classes
 * @param {boolean} inset - Add left padding for consistency
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu label
 */
const DropdownMenuLabel = React.forwardRef(
  ({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Label
      ref={ref}
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2 py-1.5 text-xs font-semibold text-muted-foreground tracking-wider uppercase data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
);

DropdownMenuLabel.displayName = "DropdownMenuLabel";

/**
 * DropdownMenuSeparator Component
 * Visual divider between menu groups.
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu separator
 */
const DropdownMenuSeparator = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
);

DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

/**
 * DropdownMenuShortcut Component
 * Displays keyboard shortcut hint on the right side.
 *
 * Features:
 * - Right-aligned positioning
 * - Muted color for subtlety
 * - Wide letter spacing
 * - Small font size
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu shortcut
 */
const DropdownMenuShortcut = React.forwardRef(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs font-medium text-muted-foreground tracking-widest",
        className
      )}
      {...props}
    />
  )
);

DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

/**
 * DropdownMenuSub Component
 * Wrapper for submenu functionality.
 *
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu sub
 */
const DropdownMenuSub = (props) => (
  <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
);

DropdownMenuSub.displayName = "DropdownMenuSub";

/**
 * DropdownMenuSubTrigger Component
 * Menu item that opens a submenu.
 *
 * Features:
 * - Chevron icon on the right
 * - Open state highlighting
 * - Inset option for consistency
 * - Smooth transitions
 *
 * @param {string} className - Additional CSS classes
 * @param {boolean} inset - Add left padding for nested items
 * @param {React.ReactNode} children - Menu item content
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu sub trigger
 */
const DropdownMenuSubTrigger = React.forwardRef(
  ({ className, inset, children, ...props }, ref) => (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      data-slot="dropdown-menu-sub-trigger"
      className={cn(
        "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-hidden select-none transition-colors duration-150 focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[inset]:pl-8 hover:bg-muted/50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto h-4 w-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
);

DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

/**
 * DropdownMenuSubContent Component
 * Container for submenu items.
 *
 * Features:
 * - Smooth animations
 * - Proper positioning relative to trigger
 * - Design system colors
 * - Shadow and border styling
 *
 * @param {string} className - Additional CSS classes
 * @param {any} props - Additional component props
 *
 * @returns {React.ReactElement} Rendered dropdown menu sub content
 */
const DropdownMenuSubContent = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "bg-background text-foreground border border-border z-50 min-w-[8rem] origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-hidden rounded-lg p-1 shadow-lg transition-all duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  )
);

DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
