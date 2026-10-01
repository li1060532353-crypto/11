import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeImportRoute } from './KnowledgeImportRoute';

function mockImportApiResponse(title: string, id: string, slug: string) {
  return {
    success: true,
    data: {
      status: 'imported',
      note: {
        id,
        title,
        slug,
        summary: '摘要',
        category: '通用',
        contentJson: '{"type":"doc","content":[]}',
        contentText: '正文',
        status: 'draft',
        isPinned: false,
        isFeatured: false,
        publishedAt: null,
        reviewCount: 0,
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:00:00.000Z',
        lastReviewedAt: null,
        tags: [],
      },
      message: '导入成功',
    },
  };
}

describe('IMP-01: KnowledgeImportRoute Batch Import & Retry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('isolates single file corruption during batch import and supports retrying only failed items', async () => {
    // 1. Prepare 3 valid files and 1 broken file (Broken.md with unclosed frontmatter)
    const file1 = new File(['# Doc One\n\nValid content 1'], 'Doc-1.md', { type: 'text/markdown' });
    const fileBroken = new File(
      ['---\ntitle: Broken Document\nmalformed unclosed yaml frontmatter\n'],
      'Broken.md',
      { type: 'text/markdown' },
    );
    const file2 = new File(['# Doc Two\n\nValid content 2'], 'Doc-2.md', { type: 'text/markdown' });
    const file3 = new File(['# Doc Three\n\nValid content 3'], 'Doc-3.md', { type: 'text/markdown' });

    // Track API calls
    const importedFilenames: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/import/markdown')) {
        const body = JSON.parse(String(options?.body ?? '{}'));
        importedFilenames.push(body.filename);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockImportApiResponse(body.metadata?.title || body.filename, `id-${body.filename}`, body.metadata?.slug || body.filename),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    // 2. Render route
    render(
      <MemoryRouter>
        <KnowledgeImportRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: '导入 Markdown 笔记' })).toBeInTheDocument();

    // 3. Drop 4 files into dropzone
    const dropzone = screen.getByLabelText('拖拽或点击上传 Markdown 文件');
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file1, fileBroken, file2, file3],
      },
    });

    // 4. Verify inspect step reached: 3 valid, 1 failed
    await waitFor(() => {
      expect(screen.getByText('检查排版与元数据')).toBeInTheDocument();
    });

    // Check Broken.md is marked failed in pills
    expect(screen.getByText('⚠ Broken.md')).toBeInTheDocument();

    // Click the button to import draft notes: "导入为草稿 (3 篇)"
    const importBtn = screen.getByRole('button', { name: /导入为草稿 \(3 篇\)/ });
    expect(importBtn).toBeInTheDocument();
    fireEvent.click(importBtn);

    // 5. Wait for batch import to complete
    await waitFor(() => {
      expect(screen.getByText(/导入完成：3 篇成功，1 篇失败，0 篇跳过/)).toBeInTheDocument();
    });

    // Check itemized summary badges
    expect(screen.getByText('成功 3 篇')).toBeInTheDocument();
    expect(screen.getByText('失败 1 篇')).toBeInTheDocument();

    // Check that Broken.md displays specific failure reason
    expect(screen.getByText(/失败: YAML frontmatter 解析失败/)).toBeInTheDocument();

    // Check that only 3 valid files were sent to API
    expect(importedFilenames).toHaveLength(3);
    expect(importedFilenames).toEqual(expect.arrayContaining(['Doc-1.md', 'Doc-2.md', 'Doc-3.md']));
    expect(importedFilenames).not.toContain('Broken.md');

    // 6. Test "仅重试失败项" (Retry Failed Only)
    const retryFailedOnlyBtn = screen.getByRole('button', { name: '仅重试失败项' });
    expect(retryFailedOnlyBtn).toBeInTheDocument();

    // Clear call history
    importedFilenames.length = 0;

    fireEvent.click(retryFailedOnlyBtn);

    await waitFor(() => {
      // Still failed because Broken.md content is genuinely broken
      expect(screen.getByText(/导入完成：3 篇成功，1 篇失败，0 篇跳过/)).toBeInTheDocument();
    });

    // Crucial check: none of the 3 previously successful files were re-imported!
    expect(importedFilenames).not.toContain('Doc-1.md');
    expect(importedFilenames).not.toContain('Doc-2.md');
    expect(importedFilenames).not.toContain('Doc-3.md');
  });

  it('retries only failed items after API network failure and updates summary on recovery', async () => {
    const file1 = new File(['# Doc One\n\nValid 1'], 'Doc-1.md', { type: 'text/markdown' });
    const file2 = new File(['# Doc Two\n\nValid 2'], 'Doc-2.md', { type: 'text/markdown' });

    let file2Attempts = 0;
    const importedFilenames: string[] = [];

    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/import/markdown')) {
        const body = JSON.parse(String(options?.body ?? '{}'));
        importedFilenames.push(body.filename);

        if (body.filename === 'Doc-2.md') {
          file2Attempts++;
          if (file2Attempts === 1) {
            // Simulate network timeout failure on first attempt
            return Promise.reject(new Error('网络请求超时'));
          }
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockImportApiResponse(body.filename, `id-${body.filename}`, body.filename),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <KnowledgeImportRoute />
      </MemoryRouter>,
    );

    const dropzone = screen.getByLabelText('拖拽或点击上传 Markdown 文件');
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file1, file2],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /导入为草稿 \(2 篇\)/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /导入为草稿 \(2 篇\)/ }));

    // Wait for first import batch: 1 success, 1 failure
    await waitFor(() => {
      expect(screen.getByText(/导入完成：1 篇成功，1 篇失败，0 篇跳过/)).toBeInTheDocument();
    });

    expect(screen.getByText('成功 1 篇')).toBeInTheDocument();
    expect(screen.getByText('失败 1 篇')).toBeInTheDocument();
    expect(screen.getByText(/失败: 网络请求超时/)).toBeInTheDocument();

    // Verify Doc-1 and Doc-2 both called once
    expect(importedFilenames).toEqual(['Doc-1.md', 'Doc-2.md']);

    // Now click "仅重试失败项"
    importedFilenames.length = 0;
    const retryBtn = screen.getByRole('button', { name: '仅重试失败项' });
    fireEvent.click(retryBtn);

    // Wait for retry to succeed
    await waitFor(() => {
      expect(screen.getByText(/导入完成：2 篇成功，0 篇失败，0 篇跳过/)).toBeInTheDocument();
    });

    expect(screen.getByText('成功 2 篇')).toBeInTheDocument();
    expect(screen.queryByText('失败 1 篇')).not.toBeInTheDocument();

    // Doc-1 was NOT re-imported! Only Doc-2 was retried!
    expect(importedFilenames).toEqual(['Doc-2.md']);
  });

  it('limits batch import concurrency strictly to at most 3', async () => {
    const files = Array.from({ length: 6 }, (_, i) =>
      new File([`# File ${i}\n\nContent ${i}`], `File-${i}.md`, { type: 'text/markdown' }),
    );

    let activeRequests = 0;
    let maxConcurrency = 0;

    const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.includes('/api/import/markdown')) {
        activeRequests++;
        maxConcurrency = Math.max(maxConcurrency, activeRequests);
        const body = JSON.parse(String(options?.body ?? '{}'));

        // Delay to test concurrent workers
        await new Promise((res) => setTimeout(res, 50));

        activeRequests--;
        return {
          ok: true,
          status: 200,
          json: async () => mockImportApiResponse(body.filename, `id-${body.filename}`, body.filename),
        };
      }
      return Promise.reject(new Error('Unknown url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <KnowledgeImportRoute />
      </MemoryRouter>,
    );

    const dropzone = screen.getByLabelText('拖拽或点击上传 Markdown 文件');
    fireEvent.drop(dropzone, {
      dataTransfer: { files },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /导入为草稿 \(6 篇\)/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /导入为草稿 \(6 篇\)/ }));

    await waitFor(
      () => {
        expect(screen.getByText(/导入完成：6 篇成功，0 篇失败，0 篇跳过/)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Max concurrency must not exceed 3
    expect(maxConcurrency).toBeLessThanOrEqual(3);
    expect(maxConcurrency).toBeGreaterThanOrEqual(1);
  });

  it('detects duplicate articles and displays duplicate warning banner', async () => {
    const file1 = new File(['# Same Title\n\nContent A'], 'file1.md', { type: 'text/markdown' });
    const file2 = new File(['# Same Title\n\nContent B'], 'file2.md', { type: 'text/markdown' });

    render(
      <MemoryRouter>
        <KnowledgeImportRoute />
      </MemoryRouter>,
    );

    const dropzone = screen.getByLabelText('拖拽或点击上传 Markdown 文件');
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file1, file2] },
    });

    await waitFor(() => {
      expect(screen.getByText('检查排版与元数据')).toBeInTheDocument();
    });

    // Warning banner should be rendered
    expect(screen.getByText('⚠ 检测到重复文章，建议确认是否覆盖')).toBeInTheDocument();
  });

  it('isolates files with illegal null bytes and displays specific error message', async () => {
    const legalFile = new File(['# Legal Doc\n\nLegal text'], 'legal.md', { type: 'text/markdown' });
    const corruptFile = new File(['# Corrupted\0null byte binary'], 'corrupt.md', { type: 'text/markdown' });

    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/import/markdown')) {
        const body = JSON.parse(String(options?.body ?? '{}'));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockImportApiResponse(body.filename, `id-${body.filename}`, body.filename),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <KnowledgeImportRoute />
      </MemoryRouter>,
    );

    const dropzone = screen.getByLabelText('拖拽或点击上传 Markdown 文件');
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [legalFile, corruptFile] },
    });

    await waitFor(() => {
      expect(screen.getByText('⚠ corrupt.md')).toBeInTheDocument();
    });

    // In inspect, click import button
    fireEvent.click(screen.getByRole('button', { name: /导入为草稿 \(1 篇\)/ }));

    await waitFor(() => {
      expect(screen.getByText(/导入完成：1 篇成功，1 篇失败，0 篇跳过/)).toBeInTheDocument();
    });

    expect(screen.getByText(/失败: Markdown 结构解析失败: 文件包含非法不可解析字符/)).toBeInTheDocument();
  });

  it('supports individual item retry from the failure row', async () => {
    const file = new File(['# Retry Me\n\nContent'], 'retry-me.md', { type: 'text/markdown' });

    let attempts = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/import/markdown')) {
        attempts++;
        if (attempts === 1) {
          return Promise.reject(new Error('网络请求超时'));
        }
        const body = JSON.parse(String(options?.body ?? '{}'));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockImportApiResponse(body.filename, 'id-1', body.filename),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <KnowledgeImportRoute />
      </MemoryRouter>,
    );

    const dropzone = screen.getByLabelText('拖拽或点击上传 Markdown 文件');
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /导入为草稿 \(1 篇\)/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /导入为草稿 \(1 篇\)/ }));

    await waitFor(() => {
      expect(screen.getByText(/导入完成：0 篇成功，1 篇失败，0 篇跳过/)).toBeInTheDocument();
    });

    // Click single item "重试" button in the row
    const singleRetryBtn = screen.getByRole('button', { name: '重试' });
    fireEvent.click(singleRetryBtn);

    await waitFor(() => {
      expect(screen.getByText(/导入完成：1 篇成功，0 篇失败，0 篇跳过/)).toBeInTheDocument();
    });

    expect(screen.getByText('成功 1 篇')).toBeInTheDocument();
    expect(screen.getByText('阅读文章')).toHaveAttribute('href', '/knowledge/notes/id-1/read');
    expect(screen.getByText('去编辑')).toHaveAttribute('href', '/knowledge/notes/id-1');
  });

  it('supports overwrite retry when an article is skipped due to existing duplicate', async () => {
    const file = new File(['# Duplicate Note\n\nContent'], 'dup.md', { type: 'text/markdown' });

    let receivedOverwrite = false;
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/import/markdown')) {
        const body = JSON.parse(String(options?.body ?? '{}'));
        receivedOverwrite = Boolean(body.overwrite);
        if (!body.overwrite) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                status: 'skipped',
                message: '已存在完全相同内容或链接的笔记，已跳过创建',
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockImportApiResponse(body.filename, 'id-dup', body.filename),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <KnowledgeImportRoute />
      </MemoryRouter>,
    );

    const dropzone = screen.getByLabelText('拖拽或点击上传 Markdown 文件');
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /导入为草稿 \(1 篇\)/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /导入为草稿 \(1 篇\)/ }));

    await waitFor(() => {
      expect(screen.getByText(/导入完成：0 篇成功，0 篇失败，1 篇跳过/)).toBeInTheDocument();
    });

    // Check duplicate warning banner is shown
    expect(screen.getByText('⚠ 检测到重复文章，建议确认是否覆盖')).toBeInTheDocument();

    // Click "覆盖导入"
    const overwriteBtn = screen.getByRole('button', { name: '覆盖导入' });
    fireEvent.click(overwriteBtn);

    await waitFor(() => {
      expect(screen.getByText(/导入完成：1 篇成功，0 篇失败，0 篇跳过/)).toBeInTheDocument();
    });

    expect(receivedOverwrite).toBe(true);
  });
});
