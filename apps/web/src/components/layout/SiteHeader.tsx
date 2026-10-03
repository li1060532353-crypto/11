import { useEffect, useRef, useState } from 'react';
import { NavLink, useInRouterContext, useLocation } from 'react-router-dom';

import { Container } from '../ui/Container';
import { SpotlightModal } from '../spotlight/SpotlightModal';
import { useSpotlight } from '../spotlight/useSpotlight';

const navigation = [
  { label: '文章', href: '/posts' },
  { label: '工作台', href: '/knowledge' },
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

function WorkspaceLinks({ onNavigate }: { onNavigate: () => void }) {
  const inRouter = useInRouterContext();
  const items = [{ label: '概览', href: '/knowledge' }, { label: '文章管理', href: '/knowledge/notes' }, { label: '新建文档', href: '/knowledge/create' }];
  return <ul className="nav-list">{items.map((item) => <li key={item.href}>{inRouter
    ? <NavLink end className="nav-link" to={item.href} onClick={onNavigate}>{item.label}</NavLink>
    : <a className="nav-link" href={item.href} onClick={onNavigate}>{item.label}</a>}</li>)}</ul>;
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
  const inRouter = useInRouterContext();
  return inRouter ? <RoutedSiteHeader /> : <SiteHeaderContent pathname="" />;
}
function RoutedSiteHeader() {
  const { pathname } = useLocation();
  return <SiteHeaderContent pathname={pathname} />;
}
function SiteHeaderContent({ pathname }: { pathname: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const workspace = pathname.startsWith('/knowledge');
  const spotlight = useSpotlight(!workspace);
  const drawer = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => setIsOpen(false), [pathname]);
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        toggle.current?.focus();
      }
      if (event.key === 'Tab' && window.matchMedia?.('(max-width: 63.99rem)').matches) {
        const elements = drawer.current?.querySelectorAll<HTMLElement>('a, button');
        if (!elements?.length) return;
        const first = elements[0]!;
        const last = elements[elements.length - 1]!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const previousOverflow = document.body.style.overflow;
    if (window.matchMedia?.('(max-width: 63.99rem)').matches) document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); };
  }, [isOpen]);

  return (
    <>
      <button className="site-drawer-edge" type="button" aria-label="展开左侧导航" aria-expanded={isOpen}
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') setIsOpen(true); }} onClick={() => setIsOpen(true)} />
      {isOpen ? <button className="site-drawer-backdrop" type="button" aria-label="收起导航" onClick={() => { setIsOpen(false); toggle.current?.focus(); }} /> : null}
      <nav ref={drawer} id="mobile-navigation" className="site-drawer" aria-label="主导航" data-open={isOpen} inert={!isOpen}
        onPointerLeave={(event) => { if (event.pointerType === 'mouse' && !drawer.current?.contains(document.activeElement)) setIsOpen(false); }}>
        <div className="site-drawer__heading"><strong>namdw.</strong><button className="knowledge-button" type="button" aria-label="关闭导航" onClick={() => { setIsOpen(false); toggle.current?.focus(); }}>关闭</button></div>
        <NavigationLinks onNavigate={() => setIsOpen(false)} />
        <p className="site-drawer__label">内容工作台</p>
        <WorkspaceLinks onNavigate={() => setIsOpen(false)} />
      </nav>
    <header className="site-header">
      <Container className="site-header__inner">
        <a className="brand" href="/" aria-label="namdw 首页">
          <span>namdw.</span>
          <span className="site-header__context">工程学习笔记</span>
        </a>
        <div className="site-header__actions">
          {!workspace ? <button
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
          </button> : null}
          <ThemeToggle />
          <button
            ref={toggle}
            className="menu-toggle"
            type="button"
            aria-label={isOpen ? '关闭导航' : '打开导航'}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            onClick={() => {
              setIsOpen((open) => !open);
              if (!isOpen) requestAnimationFrame(() => drawer.current?.querySelector<HTMLElement>('button, a')?.focus());
            }}
          >
            <span className="menu-toggle__lines" aria-hidden="true" />
          </button>
        </div>
      </Container>
      {!workspace && spotlight.isOpen ? <SpotlightModal onClose={spotlight.close} /> : null}
    </header>
    </>
  );
}
