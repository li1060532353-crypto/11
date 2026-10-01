import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Link } from '@tiptap/extension-link';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseTiptapDocument } from '../../../../functions/lib/notes';
import { KnowledgeImage } from './KnowledgeImage';
import { TiptapRenderer } from '../components/reading/TiptapRenderer';

describe('real editor image and attachment round trip', () => {
  it('validates actual Tiptap JSON, reopens it and renders a private raster image', () => {
    const extensions = [StarterKit.configure({ link: false }), Link, KnowledgeImage];
    const editor = new Editor({ extensions });
    editor.commands.insertContent([
      { type: 'image', attrs: { assetId: 'asset-1', alt: 'Diagram' } },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Download',
            marks: [{ type: 'link', attrs: { href: '/api/assets/asset-2' } }],
          },
        ],
      },
    ]);
    const serialized = JSON.stringify(editor.getJSON());
    const validated = parseTiptapDocument(serialized);
    const reopened = new Editor({ extensions, content: validated });
    expect(reopened.getJSON()).toEqual(editor.getJSON());
    render(<TiptapRenderer content={validated} />);
    expect(screen.getByRole('img', { name: 'Diagram' })).toHaveAttribute(
      'src',
      '/api/assets/asset-1?inline=1',
    );
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      '/api/assets/asset-2',
    );
    editor.destroy();
    reopened.destroy();
  });
});
