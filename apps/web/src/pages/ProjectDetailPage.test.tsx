import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type * as ReactRouterDom from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const routeParams = vi.hoisted(() => ({ slug: 'embedded-observability' }));
const metadataSpy = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterDom>();
  return { ...actual, useParams: () => ({ slug: routeParams.slug }) };
});

vi.mock('../hooks/useDocumentMeta', () => ({ useDocumentMeta: metadataSpy }));

vi.mock('./NotFoundPage', () => ({
  NotFoundPage: ({ resource }: { resource?: string }) => <h1>恢复：{resource}</h1>,
}));

import { ProjectDetailPage } from './ProjectDetailPage';

describe('ProjectDetailPage', () => {
  afterEach(() => {
    routeParams.slug = 'embedded-observability';
    metadataSpy.mockClear();
  });

  it('keeps its metadata hook active when its route parameter changes to recovery', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <ProjectDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(metadataSpy).toHaveBeenLastCalledWith({
        title: '嵌入式可观测性工具箱 | Namdw 的技术笔记',
        description: '为资源受限设备统一采样日志、指标和串口诊断，让现场问题可复现。',
      }),
    );

    routeParams.slug = 'missing';
    rerender(
      <MemoryRouter>
        <ProjectDetailPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '恢复：project' })).toBeInTheDocument();
    await waitFor(() =>
      expect(metadataSpy).toHaveBeenLastCalledWith({
        title: '未找到项目 | Namdw 的技术笔记',
        description: '这个项目不存在，或许已经被移除。',
      }),
    );

    routeParams.slug = 'embedded-observability';
    rerender(
      <MemoryRouter>
        <ProjectDetailPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: '嵌入式可观测性工具箱' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(metadataSpy).toHaveBeenLastCalledWith({
        title: '嵌入式可观测性工具箱 | Namdw 的技术笔记',
        description: '为资源受限设备统一采样日志、指标和串口诊断，让现场问题可复现。',
      }),
    );
  });
});
