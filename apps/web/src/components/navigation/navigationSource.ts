/**
 * NavigationSourceState protocol & safe return target utilities
 *
 * Implements:
 * - Frozen contract 1.1 (NavigationSourceState) & 1.2 (Return Path Whitelist)
 * - Acceptance criteria NAV-01, NAV-02, NAV-03, NAV-04
 */

export type NavigationSourceKind =
  | 'post_list'
  | 'search'
  | 'taxonomy'
  | 'archive'
  | 'admin_notes'
  | 'editor_preview'
  | 'direct';

export interface NavigationSourceItem {
  kind: NavigationSourceKind;
  fromPath: string;
  fromLabel: string;
  scrollY?: number | undefined;
}

export interface NavigationSourceState extends NavigationSourceItem {
  rootSource?: NavigationSourceItem | undefined;
  hopCount?: number | undefined;
}

/**
 * Whitelist of allowed internal return path prefixes.
 * External protocols (http://, https://, javascript:) or unapproved paths are strictly forbidden.
 */
export const ALLOWED_RETURN_PATH_PREFIXES = [
  '/posts',
  '/search',
  '/categories',
  '/tags',
  '/archives',
  '/knowledge/notes',
  '/knowledge',
] as const;

/**
 * Validates whether a given pathname is in the safe internal return whitelist.
 */
export function isSafeReturnPath(path: unknown): path is string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    return false;
  }
  const [pathname] = path.split(/[?#]/);
  if (!pathname || pathname.includes(':') || pathname.includes('\\') || pathname.includes('..')) {
    return false;
  }
  return ALLOWED_RETURN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Formats a return button label with leading left arrow "← " if not already present.
 */
export function formatReturnLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.startsWith('←')) {
    return trimmed;
  }
  return `← ${trimmed}`;
}

export interface SafeReturnTarget {
  path: string;
  label: string;
  kind: NavigationSourceKind;
  scrollY?: number | undefined;
  rootSource?: NavigationSourceItem | undefined;
  hopCount: number;
}

function normalizeRawItem(raw: unknown): NavigationSourceItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const kindCandidate = (obj.kind || obj.type) as string | undefined;
  let kind: NavigationSourceKind = 'direct';
  if (kindCandidate === 'search' || kindCandidate === 'search_list') {
    kind = 'search';
  } else if (kindCandidate === 'taxonomy' || kindCandidate === 'taxonomy_list') {
    kind = 'taxonomy';
  } else if (kindCandidate === 'archive') {
    kind = 'archive';
  } else if (kindCandidate === 'admin_notes') {
    kind = 'admin_notes';
  } else if (kindCandidate === 'editor_preview' || kindCandidate === 'admin_editor') {
    kind = 'editor_preview';
  } else if (kindCandidate === 'post_list') {
    kind = 'post_list';
  }

  const pathCandidate = (obj.fromPath ??
    (typeof obj.path === 'string'
      ? `${obj.path}${typeof obj.search === 'string' ? obj.search : ''}`
      : undefined)) as string | undefined;

  const labelCandidate = (obj.fromLabel ?? obj.label) as string | undefined;
  const scrollYCandidate = typeof obj.scrollY === 'number' ? obj.scrollY : undefined;

  if (isSafeReturnPath(pathCandidate) && typeof labelCandidate === 'string' && labelCandidate.trim()) {
    return {
      kind,
      fromPath: pathCandidate,
      fromLabel: formatReturnLabel(labelCandidate),
      scrollY: scrollYCandidate,
    };
  }
  return null;
}

/**
 * Resolves a safe, validated return target from router state or falls back to safe defaults.
 */
export function getSafeReturnTarget(
  state: unknown,
  fallbackPath = '/posts',
  fallbackLabel = '← 返回文章列表',
): SafeReturnTarget {
  const safeFallbackPath = isSafeReturnPath(fallbackPath) ? fallbackPath : '/posts';
  const formattedFallbackLabel = formatReturnLabel(fallbackLabel);

  if (!state || typeof state !== 'object') {
    return {
      path: safeFallbackPath,
      label: formattedFallbackLabel,
      kind: 'direct',
      scrollY: undefined,
      rootSource: undefined,
      hopCount: 0,
    };
  }

  const raw = state as Record<string, unknown>;
  const rawRoot = normalizeRawItem(raw.rootSource);
  const rawCurrent = normalizeRawItem(raw);

  const hopCount = typeof raw.hopCount === 'number' && raw.hopCount >= 0 ? raw.hopCount : 0;

  // In continuous reading (hopCount > 0 or rootSource exists), return target prefers the root source
  const resolvedTarget = rawRoot ?? rawCurrent;

  if (resolvedTarget) {
    const rootSource: NavigationSourceItem = rawRoot ?? {
      kind: resolvedTarget.kind,
      fromPath: resolvedTarget.fromPath,
      fromLabel: resolvedTarget.fromLabel,
      scrollY: resolvedTarget.scrollY,
    };

    return {
      path: resolvedTarget.fromPath,
      label: resolvedTarget.fromLabel,
      kind: resolvedTarget.kind,
      scrollY: resolvedTarget.scrollY,
      rootSource,
      hopCount,
    };
  }

  return {
    path: safeFallbackPath,
    label: formattedFallbackLabel,
    kind: 'direct',
    scrollY: undefined,
    rootSource: undefined,
    hopCount,
  };
}

/**
 * Builds navigation state for moving to adjacent posts (previous / next),
 * propagating rootSource and incrementing hopCount.
 */
export function buildAdjacentPostState(currentTarget: SafeReturnTarget): NavigationSourceState {
  const root: NavigationSourceItem = currentTarget.rootSource ?? {
    kind: currentTarget.kind,
    fromPath: currentTarget.path,
    fromLabel: currentTarget.label,
    scrollY: currentTarget.scrollY,
  };

  return {
    kind: root.kind,
    fromPath: root.fromPath,
    fromLabel: root.fromLabel,
    scrollY: root.scrollY,
    rootSource: root,
    hopCount: (currentTarget.hopCount || 0) + 1,
  };
}

/**
 * Creates navigation source state for admin notes list entries.
 */
export function createAdminNotesSourceState(
  fromPath: string,
  fromLabel = '← 返回文章列表',
  scrollY = typeof window !== 'undefined' ? window.scrollY : 0,
): NavigationSourceState {
  return {
    kind: 'admin_notes',
    fromPath,
    fromLabel: formatReturnLabel(fromLabel),
    scrollY,
  };
}
