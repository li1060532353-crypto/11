import type { HTMLAttributes } from 'react';

export function Skeleton({ 'aria-label': ariaLabel = 'Loading', className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  const classes = ['ui-skeleton', className].filter(Boolean).join(' ');

  return (
    <div {...props} aria-label={ariaLabel} aria-live="polite" className={classes} role="status">
      <span aria-hidden="true" className="ui-skeleton__shape" data-testid="skeleton-shape" />
    </div>
  );
}
