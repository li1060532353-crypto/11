import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DashboardPage } from './DashboardPage';
import { NotesPage } from './NotesPage';
import { dashboardFixture, emptyNotesFixture, notesFixture } from './fixtures';

describe('knowledge presentation shell', () => {
  it('renders dashboard statistics with an accessible heading', () => {
    render(<MemoryRouter><DashboardPage model={dashboardFixture} /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Knowledge dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Total notes')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('exposes discoverable actions for creating and browsing notes', () => {
    render(<MemoryRouter><DashboardPage model={dashboardFixture} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: '新建笔记' })).toHaveAttribute('href', '/knowledge/notes/new');
    expect(screen.getByRole('link', { name: '查看全部笔记' })).toHaveAttribute('href', '/knowledge/notes');
  });

  it('renders static loading, empty, and error variants', () => {
    const { rerender } = render(<MemoryRouter><NotesPage model={notesFixture} state="loading" /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading notes');

    rerender(<MemoryRouter><NotesPage model={emptyNotesFixture} state="empty" /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'No notes yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '创建第一篇笔记' })).toHaveAttribute('href', '/knowledge/notes/new');

    rerender(<MemoryRouter><NotesPage model={notesFixture} state="error" /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Notes could not be loaded');
  });

  it('presents pinned and archived notes with labelled search controls', () => {
    render(<MemoryRouter><NotesPage model={notesFixture} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: '新建笔记' })).toHaveAttribute('href', '/knowledge/notes/new');
    expect(screen.getByLabelText('Search notes')).toHaveAttribute('placeholder', 'Search your notes');
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeDisabled();
    expect(screen.getByText('Pinned')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Project retrospective')).toBeInTheDocument();
    expect(screen.getByText('Research archive')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Project retrospective' })).toHaveAttribute('href', '/knowledge/notes/project-retrospective');
  });
});
