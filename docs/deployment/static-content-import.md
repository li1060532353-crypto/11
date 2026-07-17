# Static Content Import

This guide explains how to add or update blog articles without using the API or database.

## Directory layout

Put each article in its own folder under `content/posts/`:

```text
content/posts/
  my-new-article/
    index.md
    cover.png
    diagram.png
```

Use `content/posts/_template/` as the starter structure for new articles.

## Frontmatter fields

The importer reads these fields from `index.md`:

- `title`: required
- `publishedAt`: required ISO datetime
- `summary`: required short description
- `coverTone`: required one of `blue`, `violet`, `teal`, `orange`
- `coverAlt`: required accessible description for the cover
- `selected`: optional, defaults to `false`
- `category`: optional if taxonomy rules can determine it
- `tags`: optional if taxonomy rules can determine them
- `seoTitle`: optional
- `seoDescription`: optional
- `coverImage`: optional local image path, usually `./cover.png`

## Images

Use standard Markdown image syntax inside the article body:

```md
![Architecture diagram](./diagram.png)
```

Rules:

- Only reference images inside the same article folder.
- Supported file types: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`
- Do not use raw HTML image tags as the main workflow.

The importer rewrites local paths into public static URLs and copies the files into the web app's public media directory.

## Commands

Validate the article set without regenerating output:

```powershell
pnpm content:check
```

Import articles and regenerate static content:

```powershell
pnpm content:import
```

Preview the frontend locally:

```powershell
pnpm content:preview
```

## Publish flow

1. Copy `content/posts/_template/` to a new article folder.
2. Edit `index.md` and add any local images.
3. Run `pnpm content:check`.
4. Run `pnpm content:import`.
5. Run `pnpm content:preview` and verify the article page.
6. Commit and push the changes.
7. Cloudflare Pages rebuilds the static site automatically.

## Taxonomy rules

Automatic categories and tags come from:

- `content/config/post-taxonomy.json`

If you want full manual control, fill `category` and `tags` directly in frontmatter.
If you want automatic classification, leave them out and let the importer apply the configured rules.

