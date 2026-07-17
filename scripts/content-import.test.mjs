import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { importContent } from './content-import.mjs';

async function withTempDir(run) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'content-import-'));
  try {
    await run(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('importContent generates posts and rewrites local markdown images into public media paths', async () => {
  await withTempDir(async (tempDir) => {
    const sourceDir = path.join(tempDir, 'content', 'posts');
    const articleDir = path.join(sourceDir, 'hello-static-blog');
    const configPath = path.join(tempDir, 'content', 'config', 'post-taxonomy.json');
    const outputFile = path.join(tempDir, 'apps', 'web', 'src', 'content', 'generatedPosts.ts');
    const publicMediaDir = path.join(tempDir, 'apps', 'web', 'public', 'content-media');

    await mkdir(articleDir, { recursive: true });
    await mkdir(path.dirname(configPath), { recursive: true });

    await writeFile(
      configPath,
      JSON.stringify(
        {
          defaultCoverTone: 'teal',
          categories: [{ name: 'Engineering', match: ['static blog', 'markdown'] }],
          tags: [{ name: 'Markdown', match: ['markdown'] }],
        },
        null,
        2,
      ),
    );

    await writeFile(
      path.join(articleDir, 'index.md'),
      `---
title: Hello Static Blog
publishedAt: 2026-07-17T09:00:00.000Z
summary: A static markdown import test.
coverTone: blue
coverAlt: Hero cover
selected: true
---
# Hello Static Blog

This markdown article includes a local image.

![Architecture](./diagram.png)
`,
    );

    await writeFile(path.join(articleDir, 'diagram.png'), Buffer.from([137, 80, 78, 71]));

    const report = await importContent({
      sourceDir,
      configPath,
      outputFile,
      publicMediaDir,
      mediaPublicBase: '/content-media',
    });

    assert.equal(report.posts.length, 1);
    assert.equal(report.posts[0].category, 'Engineering');
    assert.deepEqual(report.posts[0].tags, ['Markdown']);
    assert.match(report.posts[0].body, /!\[Architecture\]\(\/content-media\/hello-static-blog\/diagram\.png\)/);

    const generated = await readFile(outputFile, 'utf8');
    assert.match(generated, /export const generatedPosts = \[/);
    assert.match(generated, /hello-static-blog/);

    const copiedImage = await readFile(
      path.join(publicMediaDir, 'hello-static-blog', 'diagram.png'),
    );
    assert.deepEqual([...copiedImage], [137, 80, 78, 71]);
  });
});

test('importContent fails validation when an article cannot be classified', async () => {
  await withTempDir(async (tempDir) => {
    const sourceDir = path.join(tempDir, 'content', 'posts');
    const articleDir = path.join(sourceDir, 'needs-classification');
    const configPath = path.join(tempDir, 'content', 'config', 'post-taxonomy.json');
    const outputFile = path.join(tempDir, 'apps', 'web', 'src', 'content', 'generatedPosts.ts');
    const publicMediaDir = path.join(tempDir, 'apps', 'web', 'public', 'content-media');

    await mkdir(articleDir, { recursive: true });
    await mkdir(path.dirname(configPath), { recursive: true });

    await writeFile(configPath, JSON.stringify({ categories: [], tags: [] }, null, 2));
    await writeFile(
      path.join(articleDir, 'index.md'),
      `---
title: No Category
publishedAt: 2026-07-17T09:00:00.000Z
summary: Missing category should fail.
coverTone: orange
coverAlt: Missing category cover
---
# No Category
`,
    );

    await assert.rejects(
      () =>
        importContent({
          sourceDir,
          configPath,
          outputFile,
          publicMediaDir,
          mediaPublicBase: '/content-media',
        }),
      /could not determine a category/i,
    );
  });
});

test('importContent ignores underscored template directories', async () => {
  await withTempDir(async (tempDir) => {
    const sourceDir = path.join(tempDir, 'content', 'posts');
    const templateDir = path.join(sourceDir, '_template');
    const articleDir = path.join(sourceDir, 'real-article');
    const configPath = path.join(tempDir, 'content', 'config', 'post-taxonomy.json');
    const outputFile = path.join(tempDir, 'apps', 'web', 'src', 'content', 'generatedPosts.ts');
    const publicMediaDir = path.join(tempDir, 'apps', 'web', 'public', 'content-media');

    await mkdir(templateDir, { recursive: true });
    await mkdir(articleDir, { recursive: true });
    await mkdir(path.dirname(configPath), { recursive: true });

    await writeFile(
      configPath,
      JSON.stringify(
        {
          categories: [{ name: 'English', match: ['training'] }],
          tags: []
        },
        null,
        2,
      ),
    );

    await writeFile(path.join(templateDir, 'index.md'), '---\ntitle: Template\npublishedAt: 2026-07-17T09:00:00.000Z\nsummary: Template only.\ncoverTone: blue\ncoverAlt: Template cover\n---\n\n![Missing](./missing.png)\n');

    await writeFile(
      path.join(articleDir, 'index.md'),
      '---\ntitle: Real Article\npublishedAt: 2026-07-17T09:00:00.000Z\nsummary: Real import target.\ncoverTone: blue\ncoverAlt: Real cover\ncategory: English\n---\n\n# Real Article\n\ntraining\n',
    );

    const report = await importContent({
      sourceDir,
      configPath,
      outputFile,
      publicMediaDir,
      mediaPublicBase: '/content-media',
    });

    assert.equal(report.posts.length, 1);
    assert.equal(report.posts[0].slug, 'real-article');
  });
});
