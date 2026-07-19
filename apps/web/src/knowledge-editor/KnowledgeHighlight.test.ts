import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeHighlight } from './KnowledgeHighlight';

describe('KnowledgeHighlight', () => {
  function editor(content: object | string) {
    return new Editor({ extensions: [StarterKit, KnowledgeHighlight], content });
  }

  it.each(['core', 'mistake', 'mastered', 'method', 'investigate'] as const)('round-trips the %s semantic kind', (kind) => {
    const instance = editor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: kind, marks: [{ type: 'highlight', attrs: { kind } }] }] }] });
    expect(instance.getJSON()).toMatchObject({ content: [{ content: [{ marks: [{ type: 'highlight', attrs: { kind } }] }] }] });
    expect(instance.getHTML()).toContain(`data-highlight-kind="${kind}"`);
    instance.destroy();
  });

  it('parses semantic HTML back into the canonical kind and drops invalid HTML marks', () => {
    const valid = editor('<p><mark data-highlight-kind="core">Core</mark></p>');
    expect(valid.getJSON()).toMatchObject({ content: [{ content: [{ marks: [{ type: 'highlight', attrs: { kind: 'core' } }] }] }] });
    valid.destroy();

    const invalid = editor('<p><mark data-highlight-kind="rainbow" style="color:red">Unsafe</mark></p>');
    expect(invalid.getJSON()).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Unsafe' }] }] });
    expect(invalid.getHTML()).not.toContain('style=');
    invalid.destroy();
  });

  it('rejects unknown or missing kinds instead of persisting arbitrary styles', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unknown = editor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'unsafe', marks: [{ type: 'highlight', attrs: { kind: 'rainbow', style: 'color:red' } }] }] }] });
    expect(JSON.stringify(unknown.getJSON())).not.toContain('rainbow');
    expect(unknown.getHTML()).not.toContain('style=');
    unknown.destroy();

    const missing = editor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'missing', marks: [{ type: 'highlight' }] }] }] });
    expect(JSON.stringify(missing.getJSON())).not.toContain('highlight');
    missing.destroy();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
