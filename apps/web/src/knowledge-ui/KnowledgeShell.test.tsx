import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardPage } from './DashboardPage';
import { NotesPage } from './NotesPage';
import { dashboardFixture, emptyNotesFixture, notesFixture } from './fixtures';

describe('knowledge presentation shell', () => {
  it('renders dashboard statistics with an accessible heading', () => {
    render(<DashboardPage model={dashboardFixture} />);

    expect(screen.getByRole('heading', { name: 'Knowledge dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Total notes')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('renders static loading, empty, and error variants', () => {
    const { rerender } = render(<NotesPage model={notesFixture} state="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading notes');

    rerender(<NotesPage model={emptyNotesFixture} state="empty" />);
    expect(screen.getByRole('heading', { name: 'No notes yet' })).toBeInTheDocument();

    rerender(<NotesPage model={notesFixture} state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Notes could not be loaded');
  });

  it('presents pinned and archived notes with labelled search controls', () => {
    render(<NotesPage model={notesFixture} />);

    expect(screen.getByLabelText('Search notes')).toHaveAttribute('placeholder', 'Search your notes');
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeDisabled();
    expect(screen.getByText('Pinned')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Project retrospective')).toBeInTheDocument();
    expect(screen.getByText('Research archive')).toBeInTheDocument();
  });
});
