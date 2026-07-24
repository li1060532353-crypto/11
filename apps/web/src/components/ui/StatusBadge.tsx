import type { PropsWithChildren } from 'react';

type Status = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps extends PropsWithChildren {
  status?: Status;
}

export function StatusBadge({ children, status = 'neutral' }: StatusBadgeProps) {
  return <span className={`ui-status-badge ui-status-badge--${status}`}>{children}</span>;
}
