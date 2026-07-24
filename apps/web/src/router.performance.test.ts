import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routerSource = readFileSync(resolve(process.cwd(), 'src', 'router.tsx'), 'utf8');

describe('router performance boundary', () => {
  it('loads knowledge routes on demand instead of statically importing their implementations', () => {
    expect(routerSource).toContain("lazy(() => import('./knowledge/KnowledgeDashboardRoute').then");
    expect(routerSource).toContain("lazy(() => import('./knowledge/KnowledgeNotesRoute').then");
    expect(routerSource).toContain("lazy(() => import('./knowledge/KnowledgeEditorRoute').then");
    expect(routerSource).not.toContain("import { KnowledgeDashboardRoute } from './knowledge/KnowledgeDashboardRoute';");
    expect(routerSource).not.toContain("import { KnowledgeNotesRoute } from './knowledge/KnowledgeNotesRoute';");
    expect(routerSource).not.toContain("import { KnowledgeEditorRoute } from './knowledge/KnowledgeEditorRoute';");
  });
});
