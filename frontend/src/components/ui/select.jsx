'use client'

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const Select = (props) => (
  <SelectPrimitive.Root data-slot="select" {...props} />
);

const SelectGroup = (props) => (
  <SelectPrimitive.Group data-slot="select-group" {...props} />
);

const SelectValue = (props) => (
  <SelectPrimitive.Value data-slot="select-value" {...props} />
);

const SelectTrigger = React.forwardRef(
  ({ className, size = 'default', children, ...props }, ref) => (
    <SelectPrimitive.Trigger
      ref={ref}
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=sm]:h-8',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="h-4 w-4 opacity-50 flex-shrink-0" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
);

SelectTrigger.displayName = 'SelectTrigger';

const SelectContent = React.forwardRef(
  ({ className, children, position = 'popper', ...props }, ref) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        data-slot="select-content"
        className={cn(
          'relative z-50 min-w-[8rem] max-h-[var(--radix-select-content-available-height)] origin-[var(--radix-select-content-transform-origin)] overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-lg transition-all duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1 overflow-y-auto',
            position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1'
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
);

SelectContent.displayName = 'SelectContent';

const SelectLabel = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Label
      ref={ref}
      data-slot="select-label"
      className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider', className)}
      {...props}
    />
  )
);

SelectLabel.displayName = 'SelectLabel';

const SelectItem = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="select-item"
      className={cn(
        'relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm font-medium outline-hidden select-none transition-colors duration-150 focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-muted/50 [&_svg]:pointer-events-none [&_svg]:flex-shrink-0 [&_svg:not([class*="size-"])]:h-4 [&_svg:not([class*="size-"])]:w-4 [&_svg:not([class*="text-"])]:text-muted-foreground',
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
);

SelectItem.displayName = 'SelectItem';

const SelectSeparator = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Separator
      ref={ref}
      data-slot="select-separator"
      className={cn('bg-border -mx-1 my-1 h-px pointer-events-none', className)}
      {...props}
    />
  )
);

SelectSeparator.displayName = 'SelectSeparator';

const SelectScrollUpButton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      data-slot="select-scroll-up-button"
      className={cn('flex cursor-default items-center justify-center py-1 hover:bg-muted transition-colors', className)}
      {...props}
    >
      <ChevronUpIcon className="h-4 w-4" />
    </SelectPrimitive.ScrollUpButton>
  )
);

SelectScrollUpButton.displayName = 'SelectScrollUpButton';

const SelectScrollDownButton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      data-slot="select-scroll-down-button"
      className={cn('flex cursor-default items-center justify-center py-1 hover:bg-muted transition-colors', className)}
      {...props}
    >
      <ChevronDownIcon className="h-4 w-4" />
    </SelectPrimitive.ScrollDownButton>
  )
);

SelectScrollDownButton.displayName = 'SelectScrollDownButton';

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
