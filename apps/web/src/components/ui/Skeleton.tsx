import type { HTMLAttributes } from 'react';

export function Skeleton({ 'aria-label': ariaLabel = 'Loading', className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  const classes = ['ui-skeleton', className].filter(Boolean).join(' ');

  return (
    <div aria-label={ariaLabel} className={classes} role="status" {...props}>
      <span aria-hidden="true" className="ui-skeleton__shape" data-testid="skeleton-shape" />
    </div>
  );
}
