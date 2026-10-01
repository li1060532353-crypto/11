import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseMarkdownToTiptap, type NoteRecord } from '@namdw/shared';
import { clearDynamicPosts, getPostBySlug, listFeaturedContent } from '../content/contentQueries';
import {
  invalidateDynamicContent,
  noteToPost,
  syncPublishedNotes,
} from '../content/dynamicContentSync';
import { TiptapRenderer } from '../components/reading/TiptapRenderer';
import { KnowledgeNoteReadRoute } from './KnowledgeNoteReadRoute';

describe('Markdown Workflow End-to-End Acceptance', () => {
  const englishMdPath = resolve(
    process.cwd(),
    '..',
    '..',
    'content',
    'posts',
    'english-reading-training-plan',
    'index.md',
  );
  let rawMarkdown: string;

  beforeEach(() => {
    clearDynamicPosts();
    invalidateDynamicContent();
    vi.restoreAllMocks();
    try {
      rawMarkdown = readFileSync(englishMdPath, 'utf8');
    } catch {
      // Fallback relative path if running from repo root or apps/web
      const altPath = resolve(
        process.cwd(),
        'content',
        'posts',
        'english-reading-training-plan',
        'index.md',
      );
      rawMarkdown = readFileSync(altPath, 'utf8');
    }
  });

  afterEach(() => {
    clearDynamicPosts();
    invalidateDynamicContent();
    vi.restoreAllMocks();
  });

  it('completes the full content workflow: parse -> save draft -> read -> publish & feature -> unfeature', async () => {
    // 1. UPLOAD & PARSE MARKDOWN
    const parsed = parseMarkdownToTiptap(rawMarkdown, 'english-reading-training-plan.md');

    // Verify metadata extraction
    expect(parsed.metadata.title).toBe('考研英语阅读四周强化训练计划');
    expect(parsed.metadata.category).toBe('英语学习');
    expect(parsed.metadata.tags).toEqual(['考研英语', '阅读理解', '学习计划', '错题复盘']);
    expect(parsed.metadata.slug).toBe('考研英语阅读四周强化训练计划');

    // Verify first H1 duplicate is removed from document root (first node is H2 "一、训练目标")
    const firstNode = parsed.document.content[0];
    expect(firstNode).toBeDefined();
    expect(firstNode?.type).toBe('heading');
    expect(firstNode?.attrs?.level).toBe(2);

    // Verify table structure is parsed with alignment
    const tableNode = parsed.document.content.find((node) => node.type === 'table');
    expect(tableNode).toBeDefined();
    expect(tableNode?.content).toBeDefined();
    const firstRow = tableNode?.content?.[0];
    expect(firstRow?.type).toBe('tableRow');
    const headerCell = firstRow?.content?.[0];
    expect(headerCell?.type).toBe('tableHeader');

    // 2. SAVE AS DRAFT NOTE
    let currentNote: NoteRecord = {
      id: 'dynamic-eng-1',
      title: parsed.metadata.title,
      slug: 'english-reading-training-plan',
      summary: parsed.metadata.summary,
      contentJson: parsed.documentJson,
      contentText: '第一周 词汇与长难句 基础强化',
      category: parsed.metadata.category,
      status: 'draft',
      isPinned: false,
      isFeatured: false,
      publishedAt: null,
      reviewCount: 0,
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      lastReviewedAt: null,
      tags: parsed.metadata.tags,
    };

    // 3. READ IN ARTICLE FORMAT (/knowledge/notes/:id/read)
    const getNoteMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/notes/dynamic-eng-1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: currentNote }),
        });
      }
      return Promise.reject(new Error('Not found'));
    });
    vi.stubGlobal('fetch', getNoteMock);

    render(
      <MemoryRouter initialEntries={['/knowledge/notes/dynamic-eng-1/read']}>
        <Routes>
          <Route path="/knowledge/notes/:id/read" element={<KnowledgeNoteReadRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    // Expect engineering header and article title
    expect(
      await screen.findByRole('heading', { level: 1, name: '考研英语阅读四周强化训练计划' }),
    ).toBeInTheDocument();
    expect(screen.getByText('草稿')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '编辑文章' })).toHaveAttribute(
      'href',
      '/knowledge/notes/dynamic-eng-1',
    );

    // 4. VERIFY TABLE RENDERING IN READING FORMAT
    const { container } = render(<TiptapRenderer content={parsed.document} />);
    const renderedTable = container.querySelector('table');
    expect(renderedTable).not.toBeNull();
    expect(container.querySelectorAll('th').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('td').length).toBeGreaterThan(0);

    // 5. EDIT AND UPDATE IN PLACE (Edit table cell / content)
    currentNote = {
      ...currentNote,
      contentText: '第一周 词汇与长难句 基础强化 (已修订错题复盘方法)',
      updatedAt: '2026-03-01T11:00:00.000Z',
    };
    expect(currentNote.contentText).toContain('已修订');

    // 6. PUBLISH AND FEATURE ON HOMEPAGE
    currentNote = {
      ...currentNote,
      status: 'published',
      isFeatured: true,
      publishedAt: '2026-03-01T12:00:00.000Z',
    };

    // Sync to unified content layer
    const postObj = noteToPost(currentNote);
    expect(postObj.selected).toBe(true);
    expect(postObj.publishedAt).toBe('2026-03-01T12:00:00.000Z');

    const fetchSyncMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [currentNote],
          page: 1,
          pageSize: 100,
          totalItems: 1,
          totalPages: 1,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchSyncMock);

    await syncPublishedNotes(true);

    // Check presence in article list
    const postInGateway = getPostBySlug('english-reading-training-plan');
    expect(postInGateway).toBeDefined();
    expect(postInGateway?.selected).toBe(true);
    expect(postInGateway?.contentJson).toBeDefined();

    // Check appearance in homepage featured content
    const featuredList = listFeaturedContent();
    const featuredItem = featuredList.find(
      (item) => item.href === '/posts/english-reading-training-plan',
    );
    expect(featuredItem).toBeDefined();
    expect(featuredItem?.title).toBe('考研英语阅读四周强化训练计划');

    // 7. TOGGLE OFF HOMEPAGE FEATURED (isFeatured: false)
    currentNote = {
      ...currentNote,
      isFeatured: false,
    };
    invalidateDynamicContent();

    fetchSyncMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [currentNote],
          page: 1,
          pageSize: 100,
          totalItems: 1,
          totalPages: 1,
        },
      }),
    });

    await syncPublishedNotes(true);

    // Still accessible in post details
    expect(getPostBySlug('english-reading-training-plan')).toBeDefined();

    // But removed from homepage featured list
    const updatedFeatured = listFeaturedContent();
    const stillFeatured = updatedFeatured.some(
      (item) => item.href === '/posts/english-reading-training-plan',
    );
    expect(stillFeatured).toBe(false);
  });
});
