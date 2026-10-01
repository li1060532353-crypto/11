import {
  highlightKinds,
  type AssetRecord,
  type HighlightKind,
  type NoteStatus,
} from '@namdw/shared';

export { highlightKinds, type HighlightKind, type NoteStatus };

export type EditorAsset = Pick<AssetRecord, 'id'> & {
  name: string;
  mimeType?: string;
  sizeLabel: string;
  state: 'uploading' | 'ready' | 'error';
  progress?: number;
  errorMessage?: string | undefined;
  busy?: 'download' | 'delete' | undefined;
  file?: File | undefined;
};

export type EditorViewModel = {
  id?: string | undefined;
  title: string;
  summary: string;
  category: string;
  tags: readonly string[];
  contentJson: string;
  assets: readonly EditorAsset[];
  status?: NoteStatus | undefined;
  isFeatured?: boolean | undefined;
  isPinned?: boolean | undefined;
  slug?: string | undefined;
};

export const editorFixture: EditorViewModel = {
  id: 'fixture-note-1',
  title: 'Spaced repetition notes',
  summary: 'A fixture note for editor presentation.',
  category: 'Learning',
  tags: ['review', 'language'],
  contentJson: '{"type":"doc","content":[]}',
  assets: [],
  status: 'draft',
  isFeatured: false,
  isPinned: false,
  slug: 'spaced-repetition-notes',
};
