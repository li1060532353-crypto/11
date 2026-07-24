export type DashboardViewModel = {
  updatedLabel: string;
  statistics: readonly { label: string; value: string; detail: string }[];
  recentArticles?: readonly NoteCardViewModel[];
};

export type NoteCardViewModel = {
  id: string;
  title: string;
  summary: string;
  category: string;
  updatedLabel: string;
  pinned?: boolean;
  archived?: boolean;
  status?: 'draft' | 'published' | 'archived';
};

export type NotesViewModel = {
  searchTerm: string;
  filterLabel: string;
  notes: readonly NoteCardViewModel[];
};

export const dashboardFixture: DashboardViewModel = {
  updatedLabel: 'Fixture snapshot · updated today',
  statistics: [
    { label: 'Total notes', value: '24', detail: 'Across all categories' },
    { label: 'In progress', value: '8', detail: 'Draft notes to revisit' },
    { label: 'Pinned', value: '3', detail: 'Frequently referenced' },
    { label: 'Roadmap progress', value: '58%', detail: 'Current learning focus' },
  ],
};

export const notesFixture: NotesViewModel = {
  searchTerm: '',
  filterLabel: 'All notes',
  notes: [
    {
      id: 'project-retrospective',
      title: 'Project retrospective',
      summary: 'Patterns worth carrying into the next delivery cycle.',
      category: 'Work',
      updatedLabel: 'Updated today',
      pinned: true,
      status: 'draft',
    },
    {
      id: 'research-archive',
      title: 'Research archive',
      summary: 'Completed reading notes retained for future reference.',
      category: 'Learning',
      updatedLabel: 'Archived last week',
      archived: true,
      status: 'archived',
    },
  ],
};

export const emptyNotesFixture: NotesViewModel = {
  searchTerm: '',
  filterLabel: 'All notes',
  notes: [],
};
