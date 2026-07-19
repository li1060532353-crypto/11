import Highlight from '@tiptap/extension-highlight';
import { highlightKinds, type HighlightKind } from '@namdw/shared';

const highlightKindSet = new Set<string>(highlightKinds);

export function isKnowledgeHighlightKind(value: unknown): value is HighlightKind {
  return typeof value === 'string' && highlightKindSet.has(value);
}

export const KnowledgeHighlight = Highlight.extend({
  addAttributes() {
    return {
      kind: {
        default: null,
        validate: (value) => {
          if (!isKnowledgeHighlightKind(value)) throw new Error('Invalid knowledge highlight kind');
        },
        parseHTML: (element) => {
          const kind = element.getAttribute('data-highlight-kind');
          return isKnowledgeHighlightKind(kind) ? kind : null;
        },
        renderHTML: (attributes) => isKnowledgeHighlightKind(attributes.kind)
          ? { 'data-highlight-kind': attributes.kind, class: `kb-highlight kb-highlight--${attributes.kind}` }
          : {},
      },
    };
  },
  parseHTML() {
    return [{
      tag: 'mark[data-highlight-kind]',
      getAttrs: (element) => {
        const kind = element.getAttribute('data-highlight-kind');
        return isKnowledgeHighlightKind(kind) ? { kind } : false;
      },
    }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', HTMLAttributes, 0];
  },
});
