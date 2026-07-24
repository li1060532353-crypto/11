import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { DashboardPage } from './DashboardPage';
import { KnowledgeShell } from './KnowledgeShell';
import { NotesPage } from './NotesPage';
import { dashboardFixture, emptyNotesFixture, notesFixture } from './fixtures';

describe('knowledge presentation shell', () => {
  it('provides overview, articles, and settings navigation without creating a nested main landmark', () => {
    render(<MemoryRouter><KnowledgeShell title="Knowledge workspace"><p>Runtime content</p></KnowledgeShell></MemoryRouter>);

    expect(screen.getByRole('region', { name: 'Knowledge workspace' })).toHaveTextContent('Runtime content');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/knowledge');
    expect(screen.getByRole('link', { name: 'Articles' })).toHaveAttribute('href', '/knowledge/notes');
    expect(screen.getByText('Settings')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryAllByRole('main')).toHaveLength(0);
  });

  it('opens and closes the mobile knowledge navigation', () => {
    render(<MemoryRouter><KnowledgeShell title="Knowledge workspace"><p>Runtime content</p></KnowledgeShell></MemoryRouter>);

    const toggle = screen.getByRole('button', { name: 'Open knowledge navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Knowledge navigation' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close knowledge navigation' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders dashboard statistics with an accessible heading', () => {
    render(<MemoryRouter><DashboardPage model={dashboardFixture} /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
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

  it('exposes existing archive and restore actions without changing note links', () => {
    const onArchive = vi.fn();
    const onRestore = vi.fn();
    render(<MemoryRouter><NotesPage model={notesFixture} onArchive={onArchive} onRestore={onRestore} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Archive Project retrospective' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore Research archive' }));

    expect(onArchive).toHaveBeenCalledWith('project-retrospective');
    expect(onRestore).toHaveBeenCalledWith('research-archive');
    expect(screen.getByRole('link', { name: 'Project retrospective' })).toHaveAttribute('href', '/knowledge/notes/project-retrospective');
  });
});
