import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap';
  
  const variants = {
    default: 'bg-muted text-muted-foreground',
    neutral: 'bg-muted text-muted-foreground',
    success: 'bg-success-bg text-success-foreground border border-success-border',
    warning: 'bg-warning-bg text-warning-foreground border border-warning-border',
    danger: 'bg-danger-bg text-danger-foreground border border-danger-border',
    info: 'bg-info-bg text-info-foreground border border-info-border',
    outline: 'border border-border text-foreground',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
