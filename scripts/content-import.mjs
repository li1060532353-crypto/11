import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const supportedImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const defaultCoverTone = 'blue';
const defaultMediaPublicBase = '/content-media';

export async function importContent({
  sourceDir,
  configPath,
  outputFile,
  publicMediaDir,
  mediaPublicBase = defaultMediaPublicBase,
  validateOnly = false,
}) {
  const taxonomy = await loadTaxonomyConfig(configPath);
  const articleEntries = await listArticleDirectories(sourceDir);
  const posts = [];

  if (!validateOnly) {
    await rm(publicMediaDir, { recursive: true, force: true });
  }

  for (const articleDir of articleEntries) {
    const post = await importArticle({
      articleDir,
      taxonomy,
      publicMediaDir,
      mediaPublicBase,
      validateOnly,
    });
    posts.push(post);
  }

  posts.sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));

  if (!validateOnly) {
    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, renderGeneratedPosts(posts));
  }

  return {
    posts,
    generatedFile: outputFile,
    validatedOnly: validateOnly,
  };
}

async function listArticleDirectories(sourceDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true }).catch((error) => {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  });

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => path.join(sourceDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function importArticle({
  articleDir,
  taxonomy,
  publicMediaDir,
  mediaPublicBase,
  validateOnly,
}) {
  const markdownPath = path.join(articleDir, 'index.md');
  const source = await readFile(markdownPath, 'utf8');
  const { frontmatter, body } = parseMarkdownDocument(source, markdownPath);
  const title = requireString(frontmatter.title, 'title', markdownPath);
  const summary = requireString(frontmatter.summary, 'summary', markdownPath);
  const publishedAt = requirePublishedAt(frontmatter.publishedAt, markdownPath);
  const slug = slugify((frontmatter.slug || path.basename(articleDir)).toString());
  const selected = frontmatter.selected === true;
  const coverTone = normalizeCoverTone(frontmatter.coverTone || taxonomy.defaultCoverTone);
  const coverAlt = requireString(frontmatter.coverAlt, 'coverAlt', markdownPath);
  const keywordSource = [title, summary, body, path.basename(articleDir)].join('\n');
  const category = resolveCategory(frontmatter.category, taxonomy, keywordSource, markdownPath);
  const tags = resolveTags(frontmatter.tags, taxonomy, keywordSource);
  const readingTime = computeReadingTime(body);
  const rewrittenBody = await rewriteLocalImages({
    markdownBody: body,
    articleDir,
    slug,
    publicMediaDir,
    mediaPublicBase,
    validateOnly,
  });
  const coverImage = frontmatter.coverImage
    ? await rewriteAssetPath({
        assetPath: frontmatter.coverImage,
        articleDir,
        slug,
        publicMediaDir,
        mediaPublicBase,
        validateOnly,
      })
    : undefined;

  return {
    slug,
    title,
    summary,
    body: rewrittenBody,
    category,
    tags,
    publishedAt,
    readingTime,
    selected,
    cover: {
      alt: coverAlt,
      tone: coverTone,
      ...(coverImage ? { image: coverImage } : {}),
    },
    ...(frontmatter.seoTitle ? { seoTitle: String(frontmatter.seoTitle) } : {}),
    ...(frontmatter.seoDescription ? { seoDescription: String(frontmatter.seoDescription) } : {}),
  };
}

async function rewriteLocalImages({
  markdownBody,
  articleDir,
  slug,
  publicMediaDir,
  mediaPublicBase,
  validateOnly,
}) {
  const matches = [...markdownBody.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)];
  let rewritten = markdownBody;

  for (const match of matches) {
    const original = match[0];
    const assetPath = match[2];
    if (!assetPath.startsWith('./') && !assetPath.startsWith('../')) continue;

    const publicPath = await rewriteAssetPath({
      assetPath,
      articleDir,
      slug,
      publicMediaDir,
      mediaPublicBase,
      validateOnly,
    });
    rewritten = rewritten.replace(original, `![${match[1]}](${publicPath})`);
  }

  return rewritten;
}

async function rewriteAssetPath({
  assetPath,
  articleDir,
  slug,
  publicMediaDir,
  mediaPublicBase,
  validateOnly,
}) {
  const resolved = path.resolve(articleDir, assetPath);
  const relativeFromArticle = path.relative(articleDir, resolved);

  if (relativeFromArticle.startsWith('..') || path.isAbsolute(relativeFromArticle)) {
    throw new Error(`Asset path "${assetPath}" must stay inside ${articleDir}`);
  }

  const extension = path.extname(resolved).toLowerCase();
  if (!supportedImageExtensions.has(extension)) {
    throw new Error(`Asset path "${assetPath}" uses unsupported image type "${extension}"`);
  }

  const fileName = path.basename(resolved);
  const publicPath = `${mediaPublicBase.replace(/\/$/, '')}/${slug}/${fileName}`;

  await readFile(resolved).catch(() => {
    throw new Error(`Asset "${assetPath}" was not found for article "${slug}"`);
  });

  if (!validateOnly) {
    const outputDir = path.join(publicMediaDir, slug);
    await mkdir(outputDir, { recursive: true });
    await cp(resolved, path.join(outputDir, fileName));
  }

  return publicPath;
}

function parseMarkdownDocument(source, filePath) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`Markdown file "${filePath}" is missing frontmatter`);
  }

  return {
    frontmatter: parseFrontmatter(match[1], filePath),
    body: match[2].trim(),
  };
}

function parseFrontmatter(block, filePath) {
  const result = {};
  const lines = block.split(/\r?\n/);
  let currentKey = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch) {
      if (!currentKey || !Array.isArray(result[currentKey])) {
        throw new Error(`Invalid frontmatter list item in "${filePath}"`);
      }
      result[currentKey].push(parseScalar(listMatch[1]));
      continue;
    }

    const fieldMatch = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (!fieldMatch) {
      throw new Error(`Invalid frontmatter line "${line}" in "${filePath}"`);
    }

    const [, key, rawValue] = fieldMatch;
    result[key] = rawValue === '' ? [] : parseScalar(rawValue);
    currentKey = key;
  }

  return result;
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function loadTaxonomyConfig(configPath) {
  const source = await readFile(configPath, 'utf8').catch((error) => {
    if (error && error.code === 'ENOENT') {
      return '{"categories":[],"tags":[]}';
    }
    throw error;
  });
  const config = JSON.parse(source);
  return {
    defaultCoverTone: normalizeCoverTone(config.defaultCoverTone ?? defaultCoverTone),
    categories: Array.isArray(config.categories) ? config.categories : [],
    tags: Array.isArray(config.tags) ? config.tags : [],
  };
}

function requireString(value, key, filePath) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Frontmatter field "${key}" is required in "${filePath}"`);
  }
  return value.trim();
}

function requirePublishedAt(value, filePath) {
  const publishedAt = requireString(value, 'publishedAt', filePath);
  if (Number.isNaN(Date.parse(publishedAt))) {
    throw new Error(`Frontmatter field "publishedAt" is invalid in "${filePath}"`);
  }
  return publishedAt;
}

function normalizeCoverTone(value) {
  if (value === 'blue' || value === 'violet' || value === 'teal' || value === 'orange') {
    return value;
  }
  return defaultCoverTone;
}

function resolveCategory(category, taxonomy, keywordSource, filePath) {
  if (typeof category === 'string' && category.trim()) {
    return category.trim();
  }

  const match = matchRules(taxonomy.categories, keywordSource);
  if (!match) {
    throw new Error(`Article in "${filePath}" could not determine a category from taxonomy rules`);
  }
  return match;
}

function resolveTags(tags, taxonomy, keywordSource) {
  const resolved = [];
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag === 'string' && tag.trim()) {
        resolved.push(tag.trim());
      }
    }
  } else if (typeof tags === 'string' && tags.trim()) {
    resolved.push(tags.trim());
  }

  for (const rule of taxonomy.tags) {
    if (typeof rule?.name !== 'string' || !Array.isArray(rule.match)) continue;
    const haystack = keywordSource.toLocaleLowerCase();
    if (rule.match.some((item) => haystack.includes(String(item).toLocaleLowerCase()))) {
      resolved.push(rule.name);
    }
  }

  return [...new Set(resolved)];
}

function matchRules(rules, keywordSource) {
  const haystack = keywordSource.toLocaleLowerCase();
  for (const rule of rules) {
    if (typeof rule?.name !== 'string' || !Array.isArray(rule.match)) continue;
    if (rule.match.some((item) => haystack.includes(String(item).toLocaleLowerCase()))) {
      return rule.name;
    }
  }
  return undefined;
}

function computeReadingTime(body) {
  const words = body.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const cjkChars =
    body.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)
      ?.length ?? 0;
  return Math.max(1, Math.round((words + cjkChars) / 220));
}

function slugify(value) {
  return (
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .trim()
      .replace(/[\s-]+/gu, '-') || 'post'
  );
}

function renderGeneratedPosts(posts) {
  return `import type { Post } from './types';\n\nexport const generatedPosts = ${JSON.stringify(posts, null, 2)} as const satisfies readonly Post[];\n`;
}

async function runCli() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const validateOnly = process.argv.includes('--check');
  const report = await importContent({
    sourceDir: path.join(rootDir, 'content', 'posts'),
    configPath: path.join(rootDir, 'content', 'config', 'post-taxonomy.json'),
    outputFile: path.join(rootDir, 'apps', 'web', 'src', 'content', 'generatedPosts.ts'),
    publicMediaDir: path.join(rootDir, 'apps', 'web', 'public', 'content-media'),
    mediaPublicBase: defaultMediaPublicBase,
    validateOnly,
  });

  process.stdout.write(
    `${validateOnly ? 'Validated' : 'Imported'} ${report.posts.length} article${report.posts.length === 1 ? '' : 's'}.\n`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
