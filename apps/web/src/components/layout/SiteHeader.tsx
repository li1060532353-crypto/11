import { useState } from 'react';
import { NavLink, useInRouterContext } from 'react-router-dom';

import { Container } from '../ui/Container';

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

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="site-header">
      <Container className="site-header__inner">
        <a className="brand" href="/" aria-label="namdw 首页">
          namdw.
        </a>
        <nav className="desktop-nav" aria-label="主导航">
          <NavigationLinks />
        </nav>
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
      </Container>
      <nav id="mobile-navigation" className="mobile-nav" aria-label="移动端导航" hidden={!isOpen}>
        <NavigationLinks onNavigate={() => setIsOpen(false)} />
      </nav>
    </header>
  );
}
