import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Hero } from './Hero';
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
describe('home article search', () => {
  it('submits a trimmed Chinese query to the article results route', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Hero /><Location /></MemoryRouter>);
    await user.type(screen.getByRole('searchbox', { name: '搜索文章' }), '  矩阵  ');
    await user.click(screen.getByRole('button', { name: '搜索文章' }));
    expect(screen.getByTestId('location').textContent).toBe('/search?q=%E7%9F%A9%E9%98%B5');
  });
  it('does not navigate for an empty query', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Hero /><Location /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: '搜索文章' }));
    expect(screen.getByTestId('location').textContent).toBe('/');
  });
});
