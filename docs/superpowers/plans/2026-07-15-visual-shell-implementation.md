# Personal Blog Visual Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Module 1 status screen with the approved Apple-inspired responsive homepage shell, accessible navigation, reusable layout primitives, design tokens, and tested visual foundations.

**Architecture:** Keep the existing React/Vite application and add focused presentational components under `components/`, a homepage composition under `pages/`, typed static preview content under `content/`, and layered CSS under `styles/`. No router or API data layer is introduced in this module; links use the approved future public URLs and Module 3 will attach real routes and content.

**Tech Stack:** React 19.2.7, Vite 8.1.4, TypeScript 5.9.3, Vitest 4.1.10, Testing Library 16.3.2, jest-dom 6.9.1, User Event 14.6.1, jsdom 29.1.1, CSS custom properties

## Global Constraints

- Preserve the approved product-storytelling direction: glass navigation, large concise hero, low-saturation gradient artwork, selected content cards, and a dark about band.
- Use fog white `#F5F5F7`, ink black `#1D1D1F`, interaction blue `#0071E3`, and muted gray `#6E6E73` as the core palette.
- Support mobile, tablet, laptop, and wide desktop layouts from a 320px minimum viewport.
- Use semantic HTML, visible focus states, keyboard-accessible navigation, useful labels, and `prefers-reduced-motion` support.
- Keep this module presentational: no React Router, API fetches, database data, admin UI, or authentication.
- Keep strict TypeScript enabled and do not suppress type errors.
- Preserve the Module 1 `data-app="personal-blog"` build marker used by production smoke verification.

---

## Planned File Map

```text
apps/web/
├── index.html                              # Theme metadata and existing build marker
├── package.json                            # DOM-testing dependencies
├── vite.config.ts                          # jsdom and shared test setup
└── src/
    ├── App.test.tsx                        # Full visual-shell semantic contract
    ├── App.tsx                             # Skip link and page composition
    ├── main.tsx                            # Layered style entry
    ├── components/
    │   ├── home/
    │   │   ├── AboutBand.tsx               # Dark personal-introduction section
    │   │   ├── FeaturedContent.tsx         # Selected article/project cards
    │   │   └── Hero.tsx                    # Product-storytelling hero
    │   ├── layout/
    │   │   ├── SiteFooter.tsx              # Semantic footer
    │   │   ├── SiteHeader.test.tsx         # Accessible mobile-nav behavior
    │   │   └── SiteHeader.tsx              # Glass desktop/mobile navigation
    │   └── ui/
    │       └── Container.tsx                # Reusable width/padding primitive
    ├── content/
    │   └── homeContent.ts                  # Typed preview content
    ├── pages/
    │   └── HomePage.tsx                    # Homepage section composition
    ├── test/
    │   └── setup.ts                        # Testing Library cleanup
    └── styles/
        ├── global.css                      # Reset, typography, focus, skip link
        ├── home.css                        # Hero, cards, about section
        ├── index.css                       # Ordered stylesheet imports
        ├── motion.css                      # Motion policy and reduction
        ├── shell.css                       # Header, container, footer, responsive nav
        ├── tokens.css                      # Color, spacing, radius, shadow variables
        └── visual-contract.test.ts         # Token/responsive/motion source contract
```

### Task 1: Establish the visual test environment and CSS system

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/src/main.tsx`
- Delete: `apps/web/src/styles.css`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/styles/visual-contract.test.ts`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/global.css`
- Create: `apps/web/src/styles/shell.css`
- Create: `apps/web/src/styles/home.css`
- Create: `apps/web/src/styles/motion.css`
- Create: `apps/web/src/styles/index.css`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the existing React/Vite package and strict TypeScript configuration.
- Produces: jsdom component-test support; CSS variables such as `--color-canvas`, `--color-ink`, `--color-accent`, `--space-page`, and `--content-max`; responsive breakpoint and reduced-motion contracts; the single style entry `src/styles/index.css`.

- [ ] **Step 1: Add DOM-testing dependencies and configuration**

Replace `apps/web/package.json` with:

```json
{
  "name": "@namdw/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -p tsconfig.json && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@namdw/shared": "workspace:*",
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
  "devDependencies": {
    "@testing-library/dom": "10.4.1",
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "@types/node": "24.10.1",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.3",
    "jsdom": "29.1.1",
    "vite": "8.1.4"
  }
}
```

Replace `apps/web/vite.config.ts` with:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Create `apps/web/src/test/setup.ts`:

```ts
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

Update `apps/web/src/main.tsx` to replace `import './styles.css';` with:

```ts
import './styles/index.css';
```

- [ ] **Step 2: Write the failing visual-contract test**

Create `apps/web/src/styles/visual-contract.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readStyle(name: string) {
  return readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
}

describe('visual CSS contract', () => {
  it('defines the approved Apple-inspired palette and page scale', () => {
    const tokens = readStyle('./tokens.css');

    expect(tokens).toContain('--color-canvas: #f5f5f7');
    expect(tokens).toContain('--color-ink: #1d1d1f');
    expect(tokens).toContain('--color-accent: #0071e3');
    expect(tokens).toContain('--content-max: 75rem');
  });

  it('defines mobile navigation and reduced-motion behavior', () => {
    expect(readStyle('./shell.css')).toContain('@media (max-width: 47.99rem)');
    expect(readStyle('./motion.css')).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
```

- [ ] **Step 3: Install and verify the style contract fails for missing files**

Run:

```bash
pnpm install
pnpm --filter @namdw/web test -- visual-contract.test.ts
```

Expected: FAIL because the layered stylesheet files do not exist.

- [ ] **Step 4: Implement design tokens and global foundations**

Create `apps/web/src/styles/tokens.css`:

```css
:root {
  --color-canvas: #f5f5f7;
  --color-surface: #ffffff;
  --color-ink: #1d1d1f;
  --color-muted: #6e6e73;
  --color-border: rgba(29, 29, 31, 0.1);
  --color-accent: #0071e3;
  --color-accent-hover: #0077ed;
  --color-dark: #101012;
  --color-dark-muted: #a1a1a6;
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --content-max: 75rem;
  --reading-max: 44rem;
  --space-page: clamp(1.25rem, 4vw, 3rem);
  --space-section: clamp(5rem, 10vw, 9rem);
  --radius-pill: 999px;
  --radius-card: 1.75rem;
  --radius-visual: 2.25rem;
  --shadow-card: 0 1.5rem 4rem rgba(0, 0, 0, 0.08);
  --header-height: 3.5rem;
}
```

Create `apps/web/src/styles/global.css`:

```css
* {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  background: var(--color-canvas);
  scroll-behavior: smooth;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  color: var(--color-ink);
  background: var(--color-canvas);
  font-family: var(--font-sans);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

button,
a {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

img,
svg {
  display: block;
  max-width: 100%;
}

button {
  color: inherit;
}

:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-accent) 70%, white);
  outline-offset: 4px;
}

[hidden] {
  display: none !important;
}

.skip-link {
  position: fixed;
  z-index: 100;
  top: 0.75rem;
  left: 0.75rem;
  padding: 0.65rem 1rem;
  border-radius: var(--radius-pill);
  color: white;
  background: var(--color-accent);
  transform: translateY(-180%);
}

.skip-link:focus {
  transform: translateY(0);
}

.eyebrow {
  margin: 0;
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
```

- [ ] **Step 5: Implement shell, homepage, and motion styles**

Create `apps/web/src/styles/shell.css`:

```css
.container {
  width: min(100%, calc(var(--content-max) + 2 * var(--space-page)));
  margin-inline: auto;
  padding-inline: var(--space-page);
}

.site-header {
  position: sticky;
  z-index: 50;
  top: 0;
  min-height: var(--header-height);
  border-bottom: 1px solid var(--color-border);
  background: rgba(245, 245, 247, 0.78);
  backdrop-filter: saturate(180%) blur(1.25rem);
}

.site-header__inner {
  display: flex;
  min-height: var(--header-height);
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.brand {
  font-size: 1rem;
  font-weight: 750;
  letter-spacing: -0.04em;
}

.nav-list {
  display: flex;
  align-items: center;
  gap: clamp(1.1rem, 3vw, 2rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-link {
  color: var(--color-muted);
  font-size: 0.82rem;
  transition: color 180ms ease;
}

.nav-link:hover {
  color: var(--color-ink);
}

.menu-toggle,
.mobile-nav {
  display: none;
}

.menu-toggle {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.menu-toggle__lines,
.menu-toggle__lines::before,
.menu-toggle__lines::after {
  display: block;
  width: 1.1rem;
  height: 1px;
  margin: auto;
  background: currentColor;
  content: '';
}

.menu-toggle__lines::before {
  transform: translateY(-0.3rem);
}

.menu-toggle__lines::after {
  transform: translateY(0.25rem);
}

.mobile-nav {
  padding: 0.75rem var(--space-page) 1.25rem;
}

.mobile-nav .nav-list {
  align-items: stretch;
  flex-direction: column;
  gap: 0;
}

.mobile-nav .nav-link {
  display: block;
  padding: 0.85rem 0;
  color: var(--color-ink);
  font-size: 1rem;
}

.site-footer {
  padding-block: 2.5rem;
  border-top: 1px solid var(--color-border);
  color: var(--color-muted);
  background: var(--color-canvas);
  font-size: 0.8rem;
}

.site-footer__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.site-footer p {
  margin: 0;
}

@media (max-width: 47.99rem) {
  .desktop-nav {
    display: none;
  }

  .menu-toggle {
    display: grid;
    place-items: center;
  }

  .mobile-nav:not([hidden]) {
    display: block;
  }

  .site-footer__inner {
    align-items: flex-start;
    flex-direction: column;
  }
}
```

Create `apps/web/src/styles/home.css`:

```css
.hero {
  overflow: hidden;
  padding-block: clamp(5rem, 11vw, 9rem) var(--space-section);
  text-align: center;
}

.hero__copy {
  position: relative;
  z-index: 2;
  max-width: 58rem;
  margin-inline: auto;
}

.hero h1 {
  max-width: 15ch;
  margin: 1rem auto 1.25rem;
  font-size: clamp(3.4rem, 9vw, 7.5rem);
  font-weight: 750;
  letter-spacing: -0.075em;
  line-height: 0.94;
}

.hero h1 span {
  color: var(--color-muted);
}

.hero__lede {
  max-width: 38rem;
  margin: 0 auto;
  color: var(--color-muted);
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  line-height: 1.6;
}

.hero__actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 2rem;
}

.button-link {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  padding-inline: 1.2rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  font-size: 0.9rem;
  font-weight: 650;
}

.button-link--primary {
  border-color: var(--color-accent);
  color: white;
  background: var(--color-accent);
}

.button-link--primary:hover {
  background: var(--color-accent-hover);
}

.hero-visual {
  position: relative;
  width: min(100%, 62rem);
  min-height: clamp(15rem, 42vw, 28rem);
  margin: clamp(3rem, 7vw, 5rem) auto 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-visual);
  background:
    radial-gradient(circle at 18% 24%, rgba(255, 194, 222, 0.85), transparent 34%),
    radial-gradient(circle at 78% 22%, rgba(172, 210, 255, 0.9), transparent 38%),
    linear-gradient(145deg, #ffffff, #e8e8ed);
  box-shadow: var(--shadow-card);
}

.hero-device {
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(7rem, 18vw, 11rem);
  aspect-ratio: 0.72;
  border: clamp(5px, 0.8vw, 9px) solid #1d1d1f;
  border-radius: clamp(1.25rem, 3vw, 2.25rem);
  background: linear-gradient(155deg, #cfe4ff, #fff0f6);
  box-shadow: 0 2rem 4rem rgba(0, 0, 0, 0.22);
  transform: translate(-50%, -50%) rotate(7deg);
}

.content-section {
  padding-block: var(--space-section);
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 2rem;
}

.section-heading h2 {
  max-width: 14ch;
  margin: 0.5rem 0 0;
  font-size: clamp(2.2rem, 5vw, 4.25rem);
  letter-spacing: -0.06em;
  line-height: 1;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.feature-card {
  display: flex;
  min-height: 24rem;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.04);
  flex-direction: column;
}

.feature-card:first-child {
  grid-column: 1 / -1;
  min-height: 30rem;
}

.feature-card__visual {
  min-height: 13rem;
  background: linear-gradient(145deg, #d8e8ff, #f8dfe9);
  flex: 1;
}

.feature-card:nth-child(2) .feature-card__visual {
  background: linear-gradient(145deg, #d8f0e7, #f5f5f7);
}

.feature-card:nth-child(3) .feature-card__visual {
  background: linear-gradient(145deg, #efe2ff, #dfe9ff);
}

.feature-card__body {
  padding: clamp(1.4rem, 3vw, 2rem);
}

.feature-card__meta {
  margin: 0 0 0.65rem;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.feature-card h3 {
  margin: 0;
  font-size: clamp(1.45rem, 3vw, 2.4rem);
  letter-spacing: -0.045em;
}

.feature-card__summary {
  max-width: 48rem;
  margin: 0.8rem 0 0;
  color: var(--color-muted);
  line-height: 1.65;
}

.about-band {
  padding-block: var(--space-section);
  color: white;
  background: var(--color-dark);
}

.about-band__inner {
  display: grid;
  align-items: end;
  grid-template-columns: 1.15fr 0.85fr;
  gap: clamp(3rem, 8vw, 8rem);
}

.about-band h2 {
  margin: 0.75rem 0 0;
  font-size: clamp(2.6rem, 7vw, 6rem);
  letter-spacing: -0.07em;
  line-height: 0.98;
}

.about-band p {
  margin: 0;
  color: var(--color-dark-muted);
  font-size: clamp(1rem, 2vw, 1.2rem);
  line-height: 1.7;
}

@media (max-width: 47.99rem) {
  .hero__actions,
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .feature-grid,
  .about-band__inner {
    grid-template-columns: 1fr;
  }

  .feature-card:first-child {
    grid-column: auto;
  }
}
```

Create `apps/web/src/styles/motion.css`:

```css
.feature-card,
.button-link,
.hero-device {
  transition:
    transform 240ms ease,
    box-shadow 240ms ease,
    background-color 180ms ease;
}

.feature-card:hover {
  box-shadow: var(--shadow-card);
  transform: translateY(-0.25rem);
}

.hero-visual:hover .hero-device {
  transform: translate(-50%, -52%) rotate(4deg);
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Create `apps/web/src/styles/index.css`:

```css
@import './tokens.css';
@import './global.css';
@import './shell.css';
@import './home.css';
@import './motion.css';
```

Delete `apps/web/src/styles.css`.

- [ ] **Step 6: Verify the visual CSS foundation**

Run:

```bash
pnpm --filter @namdw/web test -- visual-contract.test.ts
pnpm --filter @namdw/web typecheck
pnpm --filter @namdw/web build
```

Expected: two CSS-contract tests pass and the web package type-checks and builds.

- [ ] **Step 7: Commit the visual foundation**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: add visual design foundations"
```

### Task 2: Build the accessible site shell

**Files:**
- Create: `apps/web/src/components/ui/Container.tsx`
- Create: `apps/web/src/components/layout/SiteHeader.test.tsx`
- Create: `apps/web/src/components/layout/SiteHeader.tsx`
- Create: `apps/web/src/components/layout/SiteFooter.tsx`

**Interfaces:**
- Consumes: `.container`, header, navigation, and footer classes from Task 1.
- Produces: `Container({ as?, className?, children })`, `SiteHeader()`, and `SiteFooter()`; future public links `/posts`, `/projects`, and `/about`; a mobile menu with `aria-expanded`, `aria-controls="mobile-navigation"`, and close-on-navigation behavior.

- [ ] **Step 1: Write the failing navigation behavior test**

Create `apps/web/src/components/layout/SiteHeader.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('opens and closes the labeled mobile navigation', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const toggle = screen.getByRole('button', { name: '打开导航' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const navigation = screen.getByRole('navigation', { name: '移动端导航' });
    expect(within(navigation).getByRole('link', { name: '文章' })).toHaveAttribute(
      'href',
      '/posts',
    );

    await user.click(within(navigation).getByRole('link', { name: '文章' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
```

- [ ] **Step 2: Run the test and verify the component is missing**

Run:

```bash
pnpm --filter @namdw/web test -- SiteHeader.test.tsx
```

Expected: FAIL because `SiteHeader.tsx` does not exist.

- [ ] **Step 3: Implement the reusable container and navigation shell**

Create `apps/web/src/components/ui/Container.tsx`:

```tsx
import type { ElementType, PropsWithChildren } from 'react';

interface ContainerProps extends PropsWithChildren {
  as?: ElementType;
  className?: string;
}

export function Container({ as: Component = 'div', className = '', children }: ContainerProps) {
  const classes = ['container', className].filter(Boolean).join(' ');

  return <Component className={classes}>{children}</Component>;
}
```

Create `apps/web/src/components/layout/SiteHeader.tsx`:

```tsx
import { useState } from 'react';

import { Container } from '../ui/Container';

const navigation = [
  { label: '文章', href: '/posts' },
  { label: '项目', href: '/projects' },
  { label: '关于', href: '/about' },
] as const;

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="nav-list">
      {navigation.map((item) => (
        <li key={item.href}>
          <a className="nav-link" href={item.href} onClick={onNavigate}>
            {item.label}
          </a>
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
      <nav
        id="mobile-navigation"
        className="mobile-nav"
        aria-label="移动端导航"
        hidden={!isOpen}
      >
        <NavigationLinks onNavigate={() => setIsOpen(false)} />
      </nav>
    </header>
  );
}
```

Create `apps/web/src/components/layout/SiteFooter.tsx`:

```tsx
import { Container } from '../ui/Container';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Container className="site-footer__inner">
        <p>© {new Date().getFullYear()} namdw. 保持好奇，持续记录。</p>
        <a href="/about">了解更多</a>
      </Container>
    </footer>
  );
}
```

- [ ] **Step 4: Verify navigation behavior and strict types**

Run:

```bash
pnpm --filter @namdw/web test -- SiteHeader.test.tsx
pnpm --filter @namdw/web typecheck
```

Expected: the mobile-navigation test passes and TypeScript reports no errors.

- [ ] **Step 5: Commit the accessible site shell**

```bash
git add apps/web/src/components
git commit -m "feat: add accessible site shell"
```

### Task 3: Compose the approved Apple-inspired homepage

**Files:**
- Create: `apps/web/src/content/homeContent.ts`
- Create: `apps/web/src/components/home/Hero.tsx`
- Create: `apps/web/src/components/home/FeaturedContent.tsx`
- Create: `apps/web/src/components/home/AboutBand.tsx`
- Create: `apps/web/src/pages/HomePage.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `Container`, `SiteHeader`, `SiteFooter`, and the Task 1 visual classes.
- Produces: typed `featuredContent`; `Hero`, `FeaturedContent`, `AboutBand`, and `HomePage`; a page with one main landmark at `#main-content`, a skip link, approved hero copy, selected project/article cards, and the dark about section.

- [ ] **Step 1: Replace the foundation test with the failing homepage contract**

Replace `apps/web/src/App.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App visual shell', () => {
  it('renders the approved product-storytelling homepage structure', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: '跳到主要内容' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(
      screen.getByRole('heading', { level: 1, name: '让复杂知识，变得清晰。' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '浏览最新文章' })).toHaveAttribute('href', '/posts');
    expect(screen.getByRole('heading', { level: 2, name: '正在构建，也持续记录。' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '智能冷链仓储系统' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '工程、学习与长期主义。' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and verify the old status screen fails the contract**

Run:

```bash
pnpm --filter @namdw/web test -- App.test.tsx
```

Expected: FAIL because the current App has no skip link, visual-shell sections, or footer.

- [ ] **Step 3: Add typed preview content**

Create `apps/web/src/content/homeContent.ts`:

```ts
export interface FeaturedItem {
  kind: '项目' | '文章';
  title: string;
  summary: string;
  meta: string;
  href: string;
}

export const featuredContent: readonly FeaturedItem[] = [
  {
    kind: '项目',
    title: '智能冷链仓储系统',
    summary: '从传感器、RFID 到云端物联网平台，把嵌入式系统连接成可观察的完整链路。',
    meta: 'STM32 · IoTDA · RFID',
    href: '/projects/smart-cold-chain',
  },
  {
    kind: '文章',
    title: '从卷积公式理解离散系统的响应',
    summary: '从单位冲激分解出发，理解每一个输入样本如何共同构成当前输出。',
    meta: '信号与系统 · 8 分钟',
    href: '/posts/discrete-convolution',
  },
  {
    kind: '文章',
    title: '从秩理解矩阵的结构',
    summary: '把“满秩”从结论还原成列向量独立、线性映射与解空间之间的联系。',
    meta: '线性代数 · 6 分钟',
    href: '/posts/matrix-rank',
  },
] as const;
```

- [ ] **Step 4: Implement the hero and content sections**

Create `apps/web/src/components/home/Hero.tsx`:

```tsx
import { Container } from '../ui/Container';

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <Container>
        <div className="hero__copy">
          <p className="eyebrow">Engineer · Creator · Explorer</p>
          <h1 id="hero-title">
            让复杂知识，<span>变得清晰。</span>
          </h1>
          <p className="hero__lede">
            记录电子信息、软件开发与工程实践，让每一次学习都留下可以复用的答案。
          </p>
          <div className="hero__actions">
            <a className="button-link button-link--primary" href="/posts">
              浏览最新文章
            </a>
            <a className="button-link" href="/projects">
              查看项目
            </a>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-device" />
        </div>
      </Container>
    </section>
  );
}
```

Create `apps/web/src/components/home/FeaturedContent.tsx`:

```tsx
import { featuredContent } from '../../content/homeContent';
import { Container } from '../ui/Container';

export function FeaturedContent() {
  return (
    <section className="content-section" aria-labelledby="featured-title">
      <Container>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Selected work</p>
            <h2 id="featured-title">正在构建，也持续记录。</h2>
          </div>
          <a className="button-link" href="/posts">
            查看全部
          </a>
        </div>
        <div className="feature-grid">
          {featuredContent.map((item) => (
            <a className="feature-card" href={item.href} key={item.href}>
              <div className="feature-card__visual" aria-hidden="true" />
              <div className="feature-card__body">
                <p className="feature-card__meta">
                  {item.kind} · {item.meta}
                </p>
                <h3>{item.title}</h3>
                <p className="feature-card__summary">{item.summary}</p>
              </div>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
```

Create `apps/web/src/components/home/AboutBand.tsx`:

```tsx
import { Container } from '../ui/Container';

export function AboutBand() {
  return (
    <section className="about-band" aria-labelledby="about-title">
      <Container className="about-band__inner">
        <div>
          <p className="eyebrow">About this space</p>
          <h2 id="about-title">工程、学习与长期主义。</h2>
        </div>
        <p>
          我是一名电子信息工程学习者。这里记录从硬件、信号与系统到软件开发的真实过程：问题、推导、失败，以及最终能够被验证的方案。
        </p>
      </Container>
    </section>
  );
}
```

- [ ] **Step 5: Compose the homepage and application shell**

Create `apps/web/src/pages/HomePage.tsx`:

```tsx
import { AboutBand } from '../components/home/AboutBand';
import { FeaturedContent } from '../components/home/FeaturedContent';
import { Hero } from '../components/home/Hero';

export function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedContent />
      <AboutBand />
    </>
  );
}
```

Replace `apps/web/src/App.tsx` with:

```tsx
import { SiteFooter } from './components/layout/SiteFooter';
import { SiteHeader } from './components/layout/SiteHeader';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <SiteHeader />
      <main id="main-content">
        <HomePage />
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 6: Verify the homepage contract and production build**

Run:

```bash
pnpm --filter @namdw/web test -- App.test.tsx
pnpm --filter @namdw/web test
pnpm --filter @namdw/web typecheck
pnpm --filter @namdw/web build
```

Expected: the App, navigation, and visual-contract tests all pass; TypeScript and Vite production build succeed.

- [ ] **Step 7: Commit the product-storytelling homepage**

```bash
git add apps/web/src
git commit -m "feat: build Apple-inspired homepage shell"
```

### Task 4: Complete accessibility metadata and Module 2 quality gate

**Files:**
- Modify: `apps/web/index.html`
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete Task 1-3 visual shell.
- Produces: Chinese page metadata and theme color while preserving `data-app="personal-blog"`; documentation of the current visual module; verified full-repository quality and production smoke gates.

- [ ] **Step 1: Update document metadata without changing the smoke marker**

Replace `apps/web/index.html` with:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f5f5f7" />
    <meta name="description" content="namdw 的个人博客：记录电子信息、软件开发与工程实践。" />
    <title>namdw. — 让复杂知识变得清晰</title>
  </head>
  <body>
    <div id="root" data-app="personal-blog"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Update the README module status**

Append to `README.md`:

```markdown
## Current implementation

- Module 1: pnpm monorepo, shared API contracts, React/Vite web app, NestJS health API
- Module 2: Apple-inspired responsive homepage shell, accessible navigation, design tokens, and reduced-motion support
```

- [ ] **Step 3: Run the complete Module 2 verification**

Run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
git diff --check
git status --short
```

Expected: supply-chain policy and frozen install pass; lint, formatting, type checking, all tests, builds, and production smoke pass; only Task 4 files remain uncommitted.

- [ ] **Step 4: Commit the verified visual module**

```bash
git add apps/web/index.html README.md
git commit -m "docs: complete visual shell module"
```

## Module 2 Completion Gate

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
git status --short
```

Expected final state:

- Every command exits with status `0`.
- Web tests cover the approved homepage structure, mobile-menu behavior, CSS palette, breakpoint, and reduced-motion contracts.
- The production build preserves `data-app="personal-blog"` and smoke verification fetches the built JavaScript asset.
- The API health endpoint remains available at `/api/v1/health`.
- `git status --short` prints no output.
- No router, API content fetch, database, authentication, or admin UI is added in this module.
