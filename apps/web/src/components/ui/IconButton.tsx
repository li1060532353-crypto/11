import type { ButtonHTMLAttributes } from 'react';

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  'aria-label': string;
}

export function IconButton({ className = '', type = 'button', ...props }: IconButtonProps) {
  const classes = ['ui-icon-button', className].filter(Boolean).join(' ');

  return <button className={classes} type={type} {...props} />;
}
