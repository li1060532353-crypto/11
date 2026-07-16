import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useDocumentMeta } from './useDocumentMeta';

function MetadataProbe() {
  useDocumentMeta({ title: '文章 | Namdw 的技术笔记', description: '最新的工程学习记录。' });
  return null;
}

describe('useDocumentMeta', () => {
  afterEach(() => {
    document.title = '';
    document.head.querySelector('meta[name="description"]')?.remove();
  });

  it('updates the document title and description meta tag', async () => {
    render(<MetadataProbe />);

    await waitFor(() => {
      expect(document.title).toBe('文章 | Namdw 的技术笔记');
      expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
        'content',
        '最新的工程学习记录。',
      );
    });
  });
});
