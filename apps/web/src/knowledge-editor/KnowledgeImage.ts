import { Node } from '@tiptap/core';

/** A private raster asset reference, never an arbitrary remote or data URL. */
export const KnowledgeImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      assetId: { default: '', parseHTML: (element) => element.getAttribute('data-asset-id') ?? '' },
      alt: { default: '', parseHTML: (element) => element.getAttribute('alt') ?? '' },
    };
  },
  parseHTML() {
    return [{ tag: 'img[data-asset-id]' }];
  },
  renderHTML({ node }) {
    const id = String(node.attrs.assetId);
    return [
      'img',
      {
        'data-asset-id': id,
        src: /^[A-Za-z0-9-]+$/.test(id)
          ? `/api/assets/${encodeURIComponent(id)}?inline=1`
          : undefined,
        alt: String(node.attrs.alt),
        style: 'max-width:100%;height:auto',
      },
    ];
  },
});
