import { afterEach, expect, it, vi } from 'vitest';
import { getPostBySlug } from './contentGateway';
import { clearDynamicPosts, getDynamicPosts, syncDynamicPosts } from './contentQueries';
import { invalidateDynamicContent } from './dynamicContentSync';

afterEach(() => {
  vi.unstubAllEnvs();
  clearDynamicPosts();
  invalidateDynamicContent();
});

it('loads a production article by slug without downloading the full collection', async () => {
  vi.stubEnv('PROD', true);
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('VITE_API_BASE_URL', '');
  const article = { slug: 'single-article', title: 'Single article', body: 'Body', summary: '', category: '', tags: [], publishedAt: '2026-10-01', readingTime: 1, selected: false, cover: { alt: '', tone: 'blue' } };
  const requests: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requests.push(url);
    return Response.json({ success: true, data: { items: [article], totalPages: 1 } });
  }));
  const result = await getPostBySlug('single-article');
  expect(result.data?.title).toBe('Single article');
  expect(requests).toEqual(['/api/public/posts?status=published&slug=single-article']);
  expect(getDynamicPosts().find(post => post.slug === 'single-article')?.body).toBe('Body');
});
it('removes a cached dynamic article after an authoritative missing response', async () => {
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_API_BASE_URL', '');
  syncDynamicPosts([{ slug: 'archived-article', title: 'Archived', body: 'Old body', summary: '', category: '', tags: [], publishedAt: '2026-10-01', readingTime: 1, selected: false, cover: { alt: '', tone: 'blue' } }]);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true, data: { items: [] } })));
  expect((await getPostBySlug('archived-article')).data).toBeUndefined();
  expect(getDynamicPosts().some(post => post.slug === 'archived-article')).toBe(false);
});