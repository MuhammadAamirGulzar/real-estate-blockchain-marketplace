import React from 'react';
import { cn } from '../../lib/utils';

const Badge = React.forwardRef(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20',
    accent: 'bg-accent/10 text-accent border-accent/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
    outline: 'border border-border text-foreground bg-background',
    solid: 'bg-primary text-primary-foreground',
    'solid-secondary': 'bg-secondary text-secondary-foreground',
    'solid-success': 'bg-success text-success-foreground',
    'solid-warning': 'bg-warning text-warning-foreground',
    'solid-error': 'bg-destructive text-destructive-foreground',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold border smooth-transition',
        variants[variant],
        className
      )}
      {...props}
    />
  );
});
Badge.displayName = 'Badge';

export { Badge };