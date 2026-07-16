import type { PropsWithChildren } from 'react';

interface ContainerProps extends PropsWithChildren {
  className?: string;
}

export function Container({ className = '', children }: ContainerProps) {
  const classes = ['container', className].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
}
