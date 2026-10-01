import { describe, expect, it } from 'vitest';

import {
  buildAdjacentPostState,
  formatReturnLabel,
  getSafeReturnTarget,
  isSafeReturnPath,
  type NavigationSourceState,
} from './navigationSource';

describe('navigationSource protocol and whitelist', () => {
  describe('isSafeReturnPath', () => {
    it('approves whitelisted internal path prefixes with or without query/hash', () => {
      expect(isSafeReturnPath('/posts')).toBe(true);
      expect(isSafeReturnPath('/posts/discrete-convolution')).toBe(true);
      expect(isSafeReturnPath('/search?q=%E7%B3%BB%E7%BB%9F&page=2')).toBe(true);
      expect(isSafeReturnPath('/categories/engineering')).toBe(true);
      expect(isSafeReturnPath('/tags/react#heading')).toBe(true);
      expect(isSafeReturnPath('/archives')).toBe(true);
      expect(isSafeReturnPath('/knowledge/notes')).toBe(true);
      expect(isSafeReturnPath('/knowledge/notes/note-123')).toBe(true);
      expect(isSafeReturnPath('/knowledge/notes/note-123/read')).toBe(true);
      expect(isSafeReturnPath('/knowledge')).toBe(true);
    });

    it('rejects external protocols, protocol-relative, path traversal, or unapproved paths', () => {
      expect(isSafeReturnPath('https://evil.com')).toBe(false);
      expect(isSafeReturnPath('http://localhost:3000/posts')).toBe(false);
      expect(isSafeReturnPath('javascript:alert(1)')).toBe(false);
      expect(isSafeReturnPath('data:text/html,evil')).toBe(false);
      expect(isSafeReturnPath('//evil.com/posts')).toBe(false);
      expect(isSafeReturnPath('/posts/../admin')).toBe(false);
      expect(isSafeReturnPath('/admin/dashboard')).toBe(false);
      expect(isSafeReturnPath('')).toBe(false);
      expect(isSafeReturnPath(null)).toBe(false);
      expect(isSafeReturnPath(undefined)).toBe(false);
    });
  });

  describe('formatReturnLabel', () => {
    it('prepends arrow if not present and preserves existing arrow', () => {
      expect(formatReturnLabel('返回文章列表')).toBe('← 返回文章列表');
      expect(formatReturnLabel('← 返回搜索结果 "ts"')).toBe('← 返回搜索结果 "ts"');
      expect(formatReturnLabel('  ← 返回分类  ')).toBe('← 返回分类');
      expect(formatReturnLabel('搜索结果 "react"')).toBe('← 搜索结果 "react"');
    });
  });

  describe('getSafeReturnTarget', () => {
    it('NAV-03: falls back to default safe target when state is empty, null or invalid', () => {
      const fallback = getSafeReturnTarget(null);
      expect(fallback.path).toBe('/posts');
      expect(fallback.label).toBe('← 返回文章列表');
      expect(fallback.kind).toBe('direct');
      expect(fallback.hopCount).toBe(0);

      const malicious = getSafeReturnTarget({
        kind: 'search',
        fromPath: 'https://attacker.com/phish',
        fromLabel: '恶意链接',
      });
      expect(malicious.path).toBe('/posts');
      expect(malicious.label).toBe('← 返回文章列表');
      expect(malicious.kind).toBe('direct');
    });

    it('NAV-01: resolves safe target from direct NavigationSourceState', () => {
      const state: NavigationSourceState = {
        kind: 'search',
        fromPath: '/search?q=%E7%B3%BB%E7%BB%9F&page=2',
        fromLabel: '搜索结果 "系统"',
        scrollY: 400,
      };

      const target = getSafeReturnTarget(state);
      expect(target.path).toBe('/search?q=%E7%B3%BB%E7%BB%9F&page=2');
      expect(target.label).toBe('← 搜索结果 "系统"');
      expect(target.kind).toBe('search');
      expect(target.scrollY).toBe(400);
      expect(target.hopCount).toBe(0);
      expect(target.rootSource?.fromPath).toBe('/search?q=%E7%B3%BB%E7%BB%9F&page=2');
    });

    it('NAV-02: prioritizes rootSource over intermediate post hops', () => {
      const state: NavigationSourceState = {
        kind: 'taxonomy',
        fromPath: '/posts/post-2',
        fromLabel: '上一篇文章',
        scrollY: 100,
        hopCount: 2,
        rootSource: {
          kind: 'taxonomy',
          fromPath: '/categories/embedded',
          fromLabel: '← 返回分类 [嵌入式系统]',
          scrollY: 240,
        },
      };

      const target = getSafeReturnTarget(state);
      expect(target.path).toBe('/categories/embedded');
      expect(target.label).toBe('← 返回分类 [嵌入式系统]');
      expect(target.kind).toBe('taxonomy');
      expect(target.scrollY).toBe(240);
      expect(target.hopCount).toBe(2);
      expect(target.rootSource?.fromPath).toBe('/categories/embedded');
    });

    it('supports UX spec RootSourceState format (type, path, search, label)', () => {
      const state = {
        rootSource: {
          type: 'search_list',
          path: '/search',
          search: '?q=rust&page=1',
          label: '← 返回搜索结果 "rust"',
          scrollY: 320,
        },
        hopCount: 1,
      };

      const target = getSafeReturnTarget(state);
      expect(target.path).toBe('/search?q=rust&page=1');
      expect(target.label).toBe('← 返回搜索结果 "rust"');
      expect(target.kind).toBe('search');
      expect(target.scrollY).toBe(320);
      expect(target.hopCount).toBe(1);
    });

    it('NAV-04: resolves custom fallback for editor and knowledge workspace', () => {
      const editorTarget = getSafeReturnTarget(
        null,
        '/knowledge/notes/note-uuid',
        '← 返回正在编辑的文章',
      );
      expect(editorTarget.path).toBe('/knowledge/notes/note-uuid');
      expect(editorTarget.label).toBe('← 返回正在编辑的文章');
    });
  });

  describe('buildAdjacentPostState', () => {
    it('NAV-02: preserves rootSource and increments hopCount on adjacent pagination', () => {
      const target = getSafeReturnTarget({
        kind: 'taxonomy',
        fromPath: '/categories/embedded',
        fromLabel: '← 返回分类 [嵌入式系统]',
        scrollY: 240,
      });

      const nextHop1 = buildAdjacentPostState(target);
      expect(nextHop1.hopCount).toBe(1);
      expect(nextHop1.rootSource?.fromPath).toBe('/categories/embedded');
      expect(nextHop1.rootSource?.fromLabel).toBe('← 返回分类 [嵌入式系统]');
      expect(nextHop1.rootSource?.scrollY).toBe(240);

      const targetHop1 = getSafeReturnTarget(nextHop1);
      const nextHop2 = buildAdjacentPostState(targetHop1);
      expect(nextHop2.hopCount).toBe(2);
      expect(nextHop2.rootSource?.fromPath).toBe('/categories/embedded');
      expect(nextHop2.rootSource?.scrollY).toBe(240);
    });
  });
});
