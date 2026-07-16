import { describe, expect, it } from 'vitest';

import {
  findPostNeighbors,
  getPostBySlug,
  groupPostsByArchive,
  listCategories,
  listFeaturedContent,
  listPosts,
  listTags,
  searchPosts,
} from './contentQueries';

describe('content queries', () => {
  it('returns posts in stable newest-first order', () => {
    const result = listPosts({ pageSize: 12 });

    expect(result.items.map((post) => post.slug)).toEqual([
      'stm32-esp01s',
      'smart-cold-chain-iotda',
      'rsa-in-practice',
      'matrix-rank',
      'discrete-convolution',
      'signal-period-analysis',
    ]);
  });

  it('projects selected project and posts into stable homepage cards', () => {
    expect(listFeaturedContent()).toEqual([
      {
        kind: '项目',
        title: '智能冷链仓储系统',
        summary: '从传感器、RFID 到云端物联网平台，把嵌入式系统连接成可观察的完整链路。',
        meta: 'STM32 · IoTDA · RFID',
        href: '/projects/smart-cold-chain',
      },
      {
        kind: '文章',
        title: '从秩理解矩阵的结构',
        summary: '把满秩从结论还原成列向量独立、线性映射与解空间之间的联系。',
        meta: '线性代数 · 6 分钟',
        href: '/posts/matrix-rank',
      },
      {
        kind: '文章',
        title: '从卷积公式理解离散系统的响应',
        summary: '从单位冲激分解出发，理解每一个输入样本如何共同构成当前输出。',
        meta: '信号与系统 · 8 分钟',
        href: '/posts/discrete-convolution',
      },
    ]);
  });

  it('finds adjacent posts beyond the paginated query limit', () => {
    const seed = listPosts().items[0]!;
    const fixture = Array.from({ length: 14 }, (_, index) => ({
      ...seed,
      slug: `post-${index}`,
      title: `Post ${index}`,
    }));

    expect(findPostNeighbors(fixture, 'post-12')).toEqual({
      previous: expect.objectContaining({ slug: 'post-11' }),
      next: expect.objectContaining({ slug: 'post-13' }),
    });
  });

  it('normalizes an invalid page and returns bounded metadata', () => {
    const result = listPosts({ page: 999, pageSize: 2 });

    expect(result.page).toBe(result.totalPages);
    expect(result.items).toHaveLength(2);
    expect(result.pageSize).toBe(2);
    expect(result.totalItems).toBe(6);
  });

  it('normalizes non-finite pagination values', () => {
    const result = listPosts({ page: Number.NaN, pageSize: Number.POSITIVE_INFINITY });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(6);
  });

  it('filters by category, tag, year, and month before pagination', () => {
    expect(listPosts({ category: '嵌入式系统' }).items.map((post) => post.slug)).toEqual([
      'stm32-esp01s',
      'smart-cold-chain-iotda',
    ]);
    expect(listPosts({ tag: '线性代数' }).items.map((post) => post.slug)).toEqual(['matrix-rank']);
    expect(listPosts({ year: 2026 }).totalItems).toBe(3);
    expect(listPosts({ year: 2026, month: 2 }).items.map((post) => post.slug)).toEqual([
      'stm32-esp01s',
      'smart-cold-chain-iotda',
    ]);
  });

  it('filters the complete repository before applying a page boundary', () => {
    const result = listPosts({ tag: '信号与系统', page: 2, pageSize: 1 });

    expect(result).toMatchObject({ page: 2, pageSize: 1, totalItems: 2, totalPages: 2 });
    expect(result.items.map((post) => post.slug)).toEqual(['signal-period-analysis']);
  });

  it('lists canonical category slugs while preserving display names', () => {
    expect(listCategories()).toContainEqual({
      slug: '嵌入式系统',
      name: '嵌入式系统',
      count: 2,
    });
  });

  it('lists lowercase tag slugs while preserving acronym display names', () => {
    expect(listTags()).toEqual(
      expect.arrayContaining([
        { slug: 'stm32', name: 'STM32', count: 1 },
        { slug: 'rfid', name: 'RFID', count: 1 },
        { slug: 'rsa', name: 'RSA', count: 1 },
      ]),
    );
  });

  it('looks up a post by exact slug', () => {
    expect(getPostBySlug('matrix-rank')?.title).toBe('从秩理解矩阵的结构');
    expect(getPostBySlug('Matrix-Rank')).toBeUndefined();
  });

  it('groups newest-first posts by archive month', () => {
    expect(
      groupPostsByArchive().map((group) => [group.year, group.month, group.posts.length]),
    ).toEqual([
      [2026, 2, 2],
      [2026, 1, 1],
      [2025, 12, 2],
      [2025, 11, 1],
    ]);
  });

  it('searches title, summary, and markdown body case-insensitively', () => {
    expect(searchPosts('RFID').totalItems).toBeGreaterThan(0);
    expect(searchPosts('响应').items.map((post) => post.slug)).toContain('discrete-convolution');
    expect(searchPosts('BAUDRATE').items.map((post) => post.slug)).toContain('stm32-esp01s');
    expect(searchPosts('nonexistent-term').totalItems).toBe(0);
  });
});
