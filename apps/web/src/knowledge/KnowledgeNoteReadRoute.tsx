import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { AssetRecord, NoteRecord } from '@namdw/shared';

import { extractHeadingsFromDocument, TiptapRenderer } from '../components/reading/TiptapRenderer';
import { ReadingProgress } from '../components/reading/ReadingProgress';
import { TableOfContents } from '../components/reading/TableOfContents';
import { Container } from '../components/ui/Container';
import { DraftingGridBackdrop } from '../components/ui/DraftingGridBackdrop';
import { useReaderNavigationOffset } from '../components/navigation/useReaderNavigationOffset';
import { FloatingReturnButton } from '../components/navigation/ReturnButton';
import { getSafeReturnTarget } from '../components/navigation/navigationSource';
import { siteContent } from '../content/site';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { getKnowledgeNote, listKnowledgeAssets, type KnowledgeApiFailure } from './knowledge-api';
import '../styles/reading.css';
import '../knowledge-ui/knowledge.css';

const statusLabels: Record<NoteRecord['status'], string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

const messageFor = (error: unknown) => {
  const kind = (error as KnowledgeApiFailure).kind;
  const messages: Record<KnowledgeApiFailure['kind'], string> = {
    access: '无权限访问该笔记。',
    validation: '笔记验证失败。',
    'not-found': '该笔记不存在或已被删除。',
    conflict: '笔记冲突。',
    repository: '知识库服务暂时不可用。',
    request: '请求失败。',
    malformed: '笔记数据格式错误。',
    network: '网络连接失败。',
  };
  return messages[kind] ?? '加载笔记失败。';
};

export function KnowledgeNoteReadRoute() {
  const { id = '' } = useParams();
  const location = useLocation();
  const readerToolbarRef = useReaderNavigationOffset<HTMLDivElement>();
  const [note, setNote] = useState<NoteRecord | null>(null);
  const [assets, setAssets] = useState<readonly AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rawState = location.state as Record<string, unknown> | null;
  const isFromEditor =
    rawState?.kind === 'editor_preview' ||
    rawState?.kind === 'admin_editor' ||
    (typeof rawState?.fromPath === 'string' &&
      rawState.fromPath.startsWith(`/knowledge/notes/${id}`));

  const fallbackPath = isFromEditor ? `/knowledge/notes/${id}` : '/knowledge/notes';
  const fallbackLabel = isFromEditor ? '← 返回正在编辑的文章' : '← 返回文章列表';

  const returnTarget = useMemo(
    () => getSafeReturnTarget(location.state, fallbackPath, fallbackLabel),
    [location.state, fallbackPath, fallbackLabel],
  );

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getKnowledgeNote(id, controller.signal)
      .then((data) => {
        setNote(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(messageFor(err));
        setLoading(false);
      });

    listKnowledgeAssets(id, controller.signal)
      .then((records) => {
        setAssets(records);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [id]);

  useDocumentMeta(
    loading
      ? { title: `正在加载笔记 | ${siteContent.name}`, description: '正在加载笔记内容。' }
      : note
        ? { title: `${note.title} (阅读模式) | ${siteContent.name}`, description: note.summary }
        : { title: `未找到笔记 | ${siteContent.name}`, description: '笔记不存在。' },
  );

  if (loading) {
    return (
      <div className="page-canvas post-detail-canvas">
        <DraftingGridBackdrop />
        <Container>
          <p className="knowledge-message" role="status">
            正在加载文章…
          </p>
        </Container>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="page-canvas post-detail-canvas">
        <DraftingGridBackdrop />
        <Container>
          <section className="knowledge-empty-state" aria-labelledby="note-not-found-title">
            <h2 id="note-not-found-title">{error ?? '未找到文章'}</h2>
            <p>该笔记可能已被移动或删除。</p>
            <Link
              className="knowledge-button knowledge-button--primary"
              to={returnTarget.path}
              state={{ restoreScroll: true, scrollY: returnTarget.scrollY }}
            >
              {returnTarget.label.replace(/^←\s*/, '')}
            </Link>
          </section>
        </Container>
      </div>
    );
  }

  const headings = extractHeadingsFromDocument(note.contentJson);
  const readingMinutes = Math.max(1, Math.ceil(note.contentText.length / 400));
  const updatedDate = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(note.updatedAt));

  return (
    <div className="page-canvas post-detail-canvas">
      <DraftingGridBackdrop />
      <ReadingProgress key={note.id} />
      <FloatingReturnButton target={returnTarget} />
      <Container>
        {/* Workspace Quick Actions Bar */}
        <div ref={readerToolbarRef} className="knowledge-reader-toolbar" aria-label="阅读模式控制条">
          <div className="knowledge-reader-toolbar__left">
            <Link
              className="knowledge-button knowledge-button--quiet"
              to={returnTarget.path}
              state={{ restoreScroll: true, scrollY: returnTarget.scrollY }}
              data-testid="knowledge-read-return-link"
            >
              {returnTarget.label}
            </Link>
            <span className={`knowledge-badge knowledge-badge--${note.status}`}>
              {statusLabels[note.status] ?? note.status}
            </span>
            {note.isFeatured ? (
              <span className="knowledge-badge knowledge-badge--pinned">首页精选</span>
            ) : null}
            {note.isPinned ? (
              <span className="knowledge-badge knowledge-badge--pinned">已置顶</span>
            ) : null}
          </div>
          <div className="knowledge-reader-toolbar__right">
            <Link
              className="knowledge-button knowledge-button--secondary"
              to={`/knowledge/notes/${note.id}`}
            >
              编辑文章
            </Link>
            {note.status === 'published' ? (
              <Link
                className="knowledge-button knowledge-button--quiet"
                to={`/posts/${note.slug}`}
                state={{
                  kind: 'editor_preview',
                  fromPath: `/knowledge/notes/${note.id}/read`,
                  fromLabel: '← 返回阅读视图',
                }}
              >
                查看文章 ↗
              </Link>
            ) : null}
          </div>
        </div>

        <article id="article-content" className="post-detail" tabIndex={-1}>
          <header className="post-detail__header">
            <div className="post-detail__intro">
              <p className="eyebrow">Knowledge Article</p>
              <h1>{note.title}</h1>
              {note.summary ? <p className="post-detail__summary">{note.summary}</p> : null}
              <div className="post-meta">
                <span className="post-meta__category">{note.category}</span>
                <span className="post-meta__divider">·</span>
                <time>{updatedDate}</time>
                <span className="post-meta__divider">·</span>
                <span>约 {readingMinutes} 分钟阅读</span>
              </div>
            </div>
          </header>

          <div className="post-detail__layout">
            <aside className="post-detail__toc">
              <TableOfContents headings={headings} />
            </aside>
            <div className="markdown-body">
              <TiptapRenderer content={note.contentJson} />
              {assets.length > 0 ? (
                <section className="knowledge-reader-attachments" aria-labelledby="reader-attachments-heading">
                  <h3 id="reader-attachments-heading">📎 相关资源与附件 ({assets.length})</h3>
                  <ul className="knowledge-reader-attachments__list">
                    {assets.map((asset) => (
                      <li key={asset.id} className="knowledge-reader-attachments__item">
                        <span className="attachment-name">{asset.originalName}</span>
                        <span className="attachment-size">({(asset.sizeBytes / 1024).toFixed(1)} KB)</span>
                        <a
                          href={`/api/assets/${encodeURIComponent(asset.id)}`}
                          download={asset.originalName}
                          className="knowledge-button knowledge-button--quiet"
                        >
                          下载 ⤓
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </div>
        </article>
      </Container>
    </div>
  );
}
