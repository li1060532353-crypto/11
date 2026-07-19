import { highlightKinds, type AssetRecord, type HighlightKind } from '@namdw/shared';

export { highlightKinds, type HighlightKind };

export type EditorAsset = Pick<AssetRecord, 'id'> & {
  name: string;
  sizeLabel: string;
  state: 'uploading' | 'ready' | 'error';
  progress?: number;
  errorMessage?: string | undefined;
  busy?: 'download' | 'delete' | undefined;
};

export type EditorViewModel = {
  title: string;
  summary: string;
  category: string;
  tags: readonly string[];
  contentJson: string;
  assets: readonly EditorAsset[];
};

export const editorFixture: EditorViewModel = {
  title: 'Spaced repetition notes',
  summary: 'A fixture note for editor presentation.',
  category: 'Learning',
  tags: ['review', 'language'],
  contentJson: '{"type":"doc","content":[]}',
  assets: [],
};
