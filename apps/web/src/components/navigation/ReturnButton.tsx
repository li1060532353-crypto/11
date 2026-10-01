import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { SafeReturnTarget } from './navigationSource';
import './navigation.css';

export interface ReturnButtonProps {
  target: SafeReturnTarget;
  className?: string;
  testId?: string;
  children?: ReactNode;
  ariaLabel?: string;
}

export function ReturnButton({
  target,
  className = 'post-detail__back-link',
  testId = 'top-return-link',
  children,
  ariaLabel,
}: ReturnButtonProps) {
  return (
    <Link
      to={target.path}
      state={{ restoreScroll: true, scrollY: target.scrollY }}
      className={className}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {children ?? target.label}
    </Link>
  );
}

export function TopReturnBar({
  target,
  className = 'post-detail__back-nav',
  testId = 'top-return-link',
}: {
  target: SafeReturnTarget;
  className?: string;
  testId?: string;
}) {
  return (
    <nav className={className} aria-label="文章返回导航">
      <ReturnButton target={target} testId={testId}>
        {target.label}
      </ReturnButton>
    </nav>
  );
}

export function BottomReturnBar({
  target,
  className = 'article-navigation__bottom-bar',
}: {
  target: SafeReturnTarget;
  className?: string;
}) {
  const isContinuous = target.hopCount > 0;
  const cleanLabel = target.label.replace(/^←\s*/, '');

  return (
    <div className={className} data-testid="bottom-return-container">
      {isContinuous ? (
        <p className="article-navigation__continuous-note">
          <span>已在文章间连续阅读 {target.hopCount} 篇 · </span>
          <Link
            to={target.path}
            state={{ restoreScroll: true, scrollY: target.scrollY }}
            className="article-navigation__return-link article-navigation__return-link--root"
            data-testid="bottom-root-return-link"
          >
            直接返回最初来源: {cleanLabel}
          </Link>
        </p>
      ) : (
        <Link
          to={target.path}
          state={{ restoreScroll: true, scrollY: target.scrollY }}
          className="article-navigation__return-link"
          data-testid="bottom-return-link"
        >
          {target.label}
        </Link>
      )}
    </div>
  );
}
