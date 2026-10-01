import { apiSuccess } from '../../../packages/shared/src/api';
import type { KnowledgeBaseEnv } from '../../env';
import { jsonError } from '../../lib/http';
import { createD1NoteStore, createNoteService, NoteDomainError } from '../../lib/notes';
import { parseMarkdownToTiptap } from '../../../packages/shared/src/markdown-converter';
import type {
  MarkdownImportRequest,
  MarkdownImportResult,
} from '../../../packages/shared/src/knowledge';

type Context = { request: Request; env: KnowledgeBaseEnv };

async function parseBody(request: Request): Promise<MarkdownImportRequest> {
  try {
    const data = (await request.json()) as unknown;
    if (
      !data ||
      typeof data !== 'object' ||
      typeof (data as Record<string, unknown>).content !== 'string' ||
      typeof (data as Record<string, unknown>).filename !== 'string'
    ) {
      throw new Error('Invalid payload');
    }
    return data as MarkdownImportRequest;
  } catch {
    throw new NoteDomainError(
      'VALIDATION_ERROR',
      'Request body must be valid JSON with filename and content',
    );
  }
}

export const onRequest = async (context: Context): Promise<Response> => {
  if (context.request.method !== 'POST') {
    return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
  }

  try {
    const input = await parseBody(context.request);
    const converted = parseMarkdownToTiptap(input.content, input.filename || 'import.md');

    const title = input.metadata?.title?.trim() || converted.metadata.title;
    const summary =
      input.metadata?.summary !== undefined
        ? input.metadata.summary.trim()
        : converted.metadata.summary;
    const category = input.metadata?.category?.trim() || converted.metadata.category;
    const tags = input.metadata?.tags ?? converted.metadata.tags;
    const slug = input.metadata?.slug?.trim() || converted.metadata.slug;
    const isFeatured =
      input.metadata?.isFeatured !== undefined
        ? input.metadata.isFeatured
        : converted.metadata.isFeatured;
    const publishedAt =
      input.metadata?.publishedAt !== undefined
        ? input.metadata.publishedAt
        : converted.metadata.publishedAt;
    const status = input.metadata?.status ?? 'draft';

    const store = createD1NoteStore(context.env.DB);
    const service = createNoteService(store);

    // Duplicate content check: look up by slug first, then check content
    const existingWithSlug = await store.list({ slug });
    const existingBySlug = existingWithSlug.items.find((n) => n.slug === slug);

    const existingList = await store.list({ pageSize: 100 });
    const exactMatch =
      existingBySlug ??
      existingList.items.find(
        (n) => n.title === title && n.contentText === converted.contentText,
      );

    if (exactMatch && !input.overwrite) {
      const result: MarkdownImportResult = {
        status: 'skipped',
        note: exactMatch,
        message: '已存在完全相同内容或链接的笔记，已跳过创建',
        warnings: converted.warnings,
      };
      return Response.json(apiSuccess(result));
    }

    if (exactMatch && input.overwrite) {
      const updatedNote = await service.update(exactMatch.id, {
        title,
        summary,
        category,
        contentJson: converted.documentJson,
        tags,
        isFeatured,
        publishedAt,
        status: exactMatch.status,
      });
      const result: MarkdownImportResult = {
        status: 'imported',
        note: updatedNote ?? exactMatch,
        message: '已覆盖更新已有文章',
        warnings: converted.warnings,
      };
      return Response.json(apiSuccess(result), { status: 200 });
    }

    // Default import as draft
    const createdNote = await service.create({
      title,
      summary,
      category,
      contentJson: converted.documentJson,
      status,
      isPinned: false,
      isFeatured,
      publishedAt,
      slug,
      tags,
    });

    const result: MarkdownImportResult = {
      status: 'imported',
      note: createdNote,
      message: '导入成功',
      warnings: converted.warnings,
    };

    return Response.json(apiSuccess(result), { status: 201 });
  } catch (error) {
    if (error instanceof NoteDomainError) {
      return jsonError(error.code, error.message, 400);
    }
    return jsonError(
      'NOTE_REPOSITORY_FAILURE',
      error instanceof Error ? error.message : 'Unable to import markdown',
      500,
    );
  }
};
