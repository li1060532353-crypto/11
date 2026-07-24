import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readStyle(name: string) {
  return readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
}

type Rgb = readonly [number, number, number];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function customProperty(styles: string, name: string) {
  const match = styles.match(new RegExp(`${escapeRegExp(name)}:\\s*(#[0-9a-f]{6})`, 'i'));

  if (!match?.[1]) throw new Error(`Missing hex custom property: ${name}`);

  return match[1];
}

function declaration(styles: string, selector: string, property: string) {
  const rule = styles.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, 's'));
  const match = rule?.[1]?.match(new RegExp(`${escapeRegExp(property)}:\\s*([^;]+);`));

  if (!match?.[1]) throw new Error(`Missing ${property} declaration for ${selector}`);

  return match[1].trim();
}

function hexToRgb(hex: string): Rgb {
  const channels = hex.slice(1).match(/.{2}/g);

  if (!channels || channels.length !== 3) throw new Error(`Invalid hex color: ${hex}`);

  return channels.map((channel) => Number.parseInt(channel, 16)) as unknown as Rgb;
}

function relativeLuminance(color: Rgb) {
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const [red, green, blue] = color;

  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(hexToRgb(foreground));
  const backgroundLuminance = relativeLuminance(hexToRgb(background));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return [
    Math.round(foreground[0] * alpha + background[0] * (1 - alpha)),
    Math.round(foreground[1] * alpha + background[1] * (1 - alpha)),
    Math.round(foreground[2] * alpha + background[2] * (1 - alpha)),
  ];
}

function rgbToHex(color: Rgb) {
  return `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

describe('visual CSS contract', () => {
  it('defines semantic light and dark token groups without losing legacy aliases', () => {
    const tokens = readStyle('./tokens.css');

    for (const name of [
      '--surface-canvas',
      '--surface-raised',
      '--text-primary',
      '--text-secondary',
      '--border-subtle',
      '--accent-solid',
      '--status-success',
      '--space-4',
      '--radius-2',
      '--shadow-1',
      '--font-body',
      '--z-header',
      '--motion-fast',
    ]) {
      expect(tokens).toContain(name);
    }

    expect(tokens).toContain('[data-theme="dark"]');
    expect(tokens).toContain('--color-canvas:');
    expect(tokens).toContain('--color-ink:');
  });

  it('keeps semantic text readable on both canvas themes', () => {
    const tokens = readStyle('./tokens.css');
    const darkTokens = tokens.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\}/)?.[1];

    expect(darkTokens).toBeDefined();
    expect(
      contrastRatio(
        customProperty(tokens, '--text-primary'),
        customProperty(tokens, '--surface-canvas'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        customProperty(darkTokens!, '--text-primary'),
        customProperty(darkTokens!, '--surface-canvas'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('uses color-scheme support and rejects shared large gradients and heavy shadows', () => {
    const sharedStyles = ['tokens.css', 'global.css', 'shell.css', 'motion.css']
      .map((name) => readStyle(`./${name}`))
      .join('\n');

    expect(readStyle('./global.css')).toContain('color-scheme: light dark');
    expect(sharedStyles).not.toMatch(/(?:linear|radial)-gradient\s*\(/i);
    expect(sharedStyles).not.toMatch(/box-shadow:\s*0\s+(?:[3-9]|\d{2,})rem/i);
    expect(sharedStyles).not.toMatch(/--shadow[^:]*:[^;}]*(?:[\s(])(?:[3-9]|\d{2,})rem/i);
  });

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

  it('preserves the 320px and reduced-motion source contracts', () => {
    const styles = ['global.css', 'shell.css', 'home.css', 'content.css', 'reading.css']
      .map((name) => readStyle(`./${name}`))
      .join('\n');
    const motion = readStyle('./motion.css');

    expect(styles).not.toMatch(
      /(?:^|[;{])\s*(?:width|min-width)\s*:\s*(?:3(?:2[1-9]|[3-9]\d)|[4-9]\d{2}|[1-9]\d{3,})px\s*;/m,
    );
    expect(motion).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*transition-duration:\s*0\.01ms\s*!important/,
    );
    expect(motion).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*scroll-behavior:\s*auto\s*!important/,
    );
  });

  it('binds readable accent text to light and dark surfaces', () => {
    const tokens = readStyle('./tokens.css');
    const global = readStyle('./global.css');
    const home = readStyle('./home.css');

    expect(declaration(global, '.eyebrow', 'color')).toBe('var(--color-accent-text-on-light)');
    expect(declaration(home, '.about-band .eyebrow', 'color')).toBe(
      'var(--color-accent-text-on-dark)',
    );
    expect(
      contrastRatio(
        customProperty(tokens, '--color-accent-text-on-light'),
        customProperty(tokens, '--color-canvas'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        customProperty(tokens, '--color-accent-text-on-dark'),
        customProperty(tokens, '--color-dark'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps primary CTA text readable on hover', () => {
    const tokens = readStyle('./tokens.css');
    const home = readStyle('./home.css');

    expect(declaration(home, '.button-link--primary:hover', 'background')).toBe(
      'var(--color-accent-hover)',
    );
    expect(
      contrastRatio('#ffffff', customProperty(tokens, '--color-accent-hover')),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('uses surface-specific focus colors with visible non-text contrast', () => {
    const tokens = readStyle('./tokens.css');
    const global = readStyle('./global.css');
    const home = readStyle('./home.css');

    expect(declaration(global, ':focus-visible', 'outline')).toBe(
      '3px solid var(--color-focus-on-light)',
    );
    expect(declaration(home, '.about-band :focus-visible', 'outline-color')).toBe(
      'var(--color-focus-on-dark)',
    );
    expect(
      contrastRatio(
        customProperty(tokens, '--color-focus-on-light'),
        customProperty(tokens, '--color-canvas'),
      ),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(
        customProperty(tokens, '--color-focus-on-dark'),
        customProperty(tokens, '--color-dark'),
      ),
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps navigation readable when the sticky glass header crosses dark content', () => {
    const tokens = readStyle('./tokens.css');
    const shell = readStyle('./shell.css');
    const background = declaration(shell, '.site-header', 'background');
    const match = background.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(0(?:\.\d+)?|1(?:\.0+)?)\)$/);

    expect(declaration(shell, '.nav-link', 'color')).toBe('var(--color-ink)');
    expect(match, 'site header must have an explicit translucent fallback').not.toBeNull();

    const [, red, green, blue, alpha] = match!;
    const effectiveHeader = rgbToHex(
      composite(
        [Number(red), Number(green), Number(blue)],
        hexToRgb(customProperty(tokens, '--color-dark')),
        Number(alpha),
      ),
    );

    expect(
      contrastRatio(customProperty(tokens, '--color-ink'), effectiveHeader),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
