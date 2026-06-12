import React from 'react';
import { cn } from '../../lib/utils';

const Button = React.forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default', 
  children, 
  ...props 
}, ref) => {
  const baseClasses = 'btn-base';
  
  const variants = {
    default: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    destructive: 'btn-destructive',
    outline: 'btn-outline',
    'outline-primary': 'btn-outline-primary',
    ghost: 'btn-ghost',
    success: 'bg-success text-success-foreground hover:bg-success/90',
    warning: 'bg-warning text-warning-foreground hover:bg-warning/90',
  };

  const sizes = {
    default: '',
    sm: 'btn-sm',
    lg: 'btn-lg',
    xl: 'btn-xl',
  };

  return (
    <button
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export { Button };