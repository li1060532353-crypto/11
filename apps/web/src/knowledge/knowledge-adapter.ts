import type { KnowledgeStats, NoteRecord, SearchResult } from '@namdw/shared';
import type { DashboardViewModel, NoteCardViewModel } from '../knowledge-ui/fixtures';
export function mapStatsToDashboard(
  stats: KnowledgeStats,
  recentArticles: readonly (NoteRecord | SearchResult)[] = [],
): DashboardViewModel {
  return {
    updatedLabel: 'Live knowledge overview',
    statistics: [
      { label: 'Total notes', value: String(stats.total), detail: 'Across all statuses' },
      { label: 'Drafts', value: String(stats.draft), detail: 'Notes in progress' },
      { label: 'Pinned', value: String(stats.pinned), detail: 'Frequently referenced' },
      { label: 'Roadmap progress', value: `${stats.roadmapProgress}%`, detail: 'Active roadmaps' },
    ],
    recentArticles: recentArticles.map(mapNoteToCard),
  };
}
export function mapNoteToCard(note: NoteRecord | SearchResult): NoteCardViewModel {
  const isPublished = 'status' in note && note.status === 'published';
  const hasUnpublishedEdits =
    isPublished &&
    'publishedContentJson' in note &&
    note.publishedContentJson !== undefined &&
    note.publishedContentJson !== null &&
    (note.publishedContentJson !== note.contentJson ||
      note.publishedTitle !== note.title ||
      note.publishedSummary !== note.summary);

  return {
    id: note.id,
    title: note.title,
    summary: note.summary,
    category: note.category,
    updatedLabel: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
      new Date(note.updatedAt),
    ),
    ...('isPinned' in note && note.isPinned ? { pinned: true } : {}),
    ...('status' in note ? { status: note.status } : {}),
    ...('status' in note && note.status === 'archived' ? { archived: true } : {}),
    ...(hasUnpublishedEdits ? { hasUnpublishedEdits: true } : {}),
  };
}
