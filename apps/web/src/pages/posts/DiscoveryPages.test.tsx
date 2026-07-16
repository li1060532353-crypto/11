import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from '../../router';

function renderAt(path: string) {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return { user };
}

function CurrentLocation() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function SearchHistoryControls() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/search?q=RSA')}>
        打开 RSA 搜索
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        后退
      </button>
      <button type="button" onClick={() => navigate(1)}>
        前进
      </button>
    </>
  );
}

describe('discovery pages', () => {
  it('renders article cards with taxonomy links and marks the active global navigation', async () => {
    renderAt('/posts');

    expect(await screen.findByRole('article', { name: /STM32 与 ESP-01S/ })).toBeInTheDocument();
    const card = screen.getByRole('article', { name: /STM32 与 ESP-01S/ });
    expect(within(card).getByRole('link', { name: '嵌入式系统' })).toHaveAttribute(
      'href',
      '/categories/%E5%B5%8C%E5%85%A5%E5%BC%8F%E7%B3%BB%E7%BB%9F',
    );
    expect(within(card).getByRole('link', { name: 'STM32' })).toHaveAttribute(
      'href',
      '/tags/stm32',
    );
    expect(screen.getByRole('link', { name: '文章' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders filtered posts from URL state', async () => {
    renderAt('/posts?category=%E5%B5%8C%E5%85%A5%E5%BC%8F%E7%B3%BB%E7%BB%9F&year=2026&page=1');
    expect(await screen.findByRole('article', { name: /STM32 与 ESP-01S/ })).toBeInTheDocument();
  });

  it('restores a canonical taxonomy selection from a display-case query value', async () => {
    renderAt('/posts?tag=STM32');

    await screen.findByRole('article', { name: /STM32 与 ESP-01S/ });
    expect(screen.getByRole('combobox', { name: '标签' })).toHaveValue('stm32');
    expect(screen.getByRole('option', { name: 'STM32' })).toHaveProperty('selected', true);
    expect(screen.getByRole('article', { name: /STM32 与 ESP-01S/ })).toBeInTheDocument();
  });

  it('labels search and preserves existing query keys when submitting', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/search?q=RFID&year=2026&page=2']}>
        <AppRoutes />
        <CurrentLocation />
      </MemoryRouter>,
    );
    expect(screen.getByRole('search', { name: '文章搜索' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('RFID');
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), '矩阵');
    await user.click(screen.getByRole('button', { name: '搜索' }));
    expect(screen.getByRole('searchbox')).toHaveValue('矩阵');
    expect(screen.getByTestId('location')).toHaveTextContent('?q=%E7%9F%A9%E9%98%B5&year=2026');
  });

  it('synchronizes the mounted search input across back and forward URL history', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/search?q=RFID']}>
        <AppRoutes />
        <SearchHistoryControls />
      </MemoryRouter>,
    );

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), '未提交草稿');
    await user.click(screen.getByRole('button', { name: '打开 RSA 搜索' }));
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('RSA'));

    await user.click(screen.getByRole('button', { name: '后退' }));
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('RFID'));

    await user.click(screen.getByRole('button', { name: '前进' }));
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('RSA'));
  });

  it('does not show an API fallback warning for the empty search-start state', async () => {
    renderAt('/search');

    expect(await screen.findByRole('heading', { name: '输入关键词开始搜索' })).toBeInTheDocument();
    expect(screen.queryByText(/内容服务暂时不可用/)).not.toBeInTheDocument();
  });

  it('renders archive groups and links their filters', async () => {
    renderAt('/archives');
    expect(await screen.findByRole('heading', { name: '2026 年 2 月' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /STM32 与 ESP-01S/ })).toHaveAttribute(
      'href',
      '/posts?year=2026&month=2',
    );
  });

  it('shows resource-aware recovery states for unknown taxonomy routes', async () => {
    renderAt('/categories/unknown');
    expect(await screen.findByRole('heading', { name: '未找到分类' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '浏览全部分类' })).toHaveAttribute(
      'href',
      '/categories',
    );
  });
});
