import { useEffect, useState } from 'react';
import { NavLink, useInRouterContext } from 'react-router-dom';

import { Container } from '../ui/Container';
import { SpotlightModal } from '../spotlight/SpotlightModal';
import { useSpotlight } from '../spotlight/useSpotlight';

const navigation = [
  { label: '文章', href: '/posts' },
  { label: '知识库', href: '/knowledge' },
  { label: '项目', href: '/projects' },
  { label: '关于', href: '/about' },
] as const;

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const inRouter = useInRouterContext();

  return (
    <ul className="nav-list">
      {navigation.map((item) => (
        <li key={item.href}>
          {inRouter ? (
            <NavLink className="nav-link" to={item.href} onClick={onNavigate}>
              {item.label}
            </NavLink>
          ) : (
            <a className="nav-link" href={item.href} onClick={onNavigate}>
              {item.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const prefersDark =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved === 'dark' || (!saved && prefersDark) ? 'dark' : 'light';

    setTheme(initial);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initial);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', next);
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={theme === 'dark' ? '切换为浅色模式' : '切换为深色模式'}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const spotlight = useSpotlight();

  return (
    <header className="site-header">
      <Container className="site-header__inner">
        <a className="brand" href="/" aria-label="namdw 首页">
          <span>namdw.</span>
          <span className="site-header__context">工程学习笔记</span>
        </a>
        <div className="site-header__actions">
          <nav className="desktop-nav" aria-label="主导航">
            <NavigationLinks />
          </nav>
          <button
            type="button"
            className="spotlight-trigger"
            aria-label="搜索 (⌘K)"
            onClick={spotlight.open}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <kbd className="spotlight-trigger__kbd">⌘K</kbd>
          </button>
          <ThemeToggle />
          <button
            className="menu-toggle"
            type="button"
            aria-label={isOpen ? '关闭导航' : '打开导航'}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsOpen((open) => !open)}
          >
            <span className="menu-toggle__lines" aria-hidden="true" />
          </button>
        </div>
      </Container>
      <nav id="mobile-navigation" className="mobile-nav" aria-label="移动端导航" hidden={!isOpen}>
        <NavigationLinks onNavigate={() => setIsOpen(false)} />
      </nav>
      {spotlight.isOpen ? <SpotlightModal onClose={spotlight.close} /> : null}
    </header>
  );
}
