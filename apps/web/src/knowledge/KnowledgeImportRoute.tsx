import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  parseMarkdownToTiptap,
  type MarkdownConversionResult,
  type NoteRecord,
} from '@namdw/shared';

import { extractHeadingsFromDocument, TiptapRenderer } from '../components/reading/TiptapRenderer';
import { TableOfContents } from '../components/reading/TableOfContents';
import { Container } from '../components/ui/Container';
import { DraftingGridBackdrop } from '../components/ui/DraftingGridBackdrop';
import { importMarkdownNote } from './knowledge-api';
import { invalidateDynamicContent } from '../content/dynamicContentSync';
import '../knowledge-ui/knowledge.css';
import '../styles/reading.css';

type FileItem = {
  id: string;
  name: string;
  sizeBytes: number;
  content: string;
  parsed: MarkdownConversionResult;
  title: string;
  summary: string;
  category: string;
  tagsString: string;
  slug: string;
  overwrite: boolean;
  status: 'pending' | 'uploading' | 'imported' | 'skipped' | 'failed';
  message?: string | undefined;
  errorMessage?: string | undefined;
  importedNote?: NoteRecord | undefined;
};

type Step = 'select' | 'inspect' | 'complete';

export function KnowledgeImportRoute() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('select');
  const [items, setItems] = useState<FileItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [mobileView, setMobileView] = useState<'info' | 'preview'>('info');
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const activeItem = items[activeItemIndex];

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((file) =>
      /\.(?:md|markdown|txt)$/i.test(file.name),
    );

    if (validFiles.length === 0) return;

    const reads = validFiles.map((file) => {
      return new Promise<FileItem>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = String(reader.result ?? '');
          const parsed = parseMarkdownToTiptap(content, file.name);
          resolve({
            id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            sizeBytes: file.size,
            content,
            parsed,
            title: parsed.metadata.title,
            summary: parsed.metadata.summary,
            category: parsed.metadata.category,
            tagsString: parsed.metadata.tags.join(', '),
            slug: parsed.metadata.slug,
            overwrite: false,
            status: 'pending',
          });
        };
        reader.readAsText(file, 'utf-8');
      });
    });

    Promise.all(reads).then((newItems) => {
      setItems((prev) => [...prev, ...newItems]);
      setStep('inspect');
      setActiveItemIndex(0);
    });
  }, []);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => {
    setDragActive(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
    }
  };

  // Step 3: Run batch import with concurrency 3
  const runBatchImport = async () => {
    setStep('complete');
    setImporting(true);
    setCompletedCount(0);

    const queue = [...items];
    const concurrency = 3;
    let index = 0;
    let done = 0;

    const worker = async () => {
      while (index < queue.length) {
        const currentIdx = index++;
        const item = queue[currentIdx];
        if (!item || item.status === 'imported') continue;

        // Set uploading state
        setItems((prev) =>
          prev.map((it, i) => (i === currentIdx ? { ...it, status: 'uploading' } : it)),
        );

        try {
          const tags = item.tagsString
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

          const result = await importMarkdownNote({
            filename: item.name,
            content: item.content,
            overwrite: Boolean(item.overwrite),
            metadata: {
              title: item.title,
              summary: item.summary,
              category: item.category,
              tags,
              slug: item.slug,
              isFeatured: item.parsed.metadata.isFeatured,
              publishedAt: item.parsed.metadata.publishedAt,
              status: 'draft',
            },
          });

          setItems((prev) =>
            prev.map((it, i) =>
              i === currentIdx
                ? {
                    ...it,
                    status: result.status,
                    importedNote: result.note,
                    message: result.message,
                    errorMessage: result.status === 'failed' ? result.message : undefined,
                  }
                : it,
            ),
          );
        } catch (err) {
          setItems((prev) =>
            prev.map((it, i) =>
              i === currentIdx
                ? {
                    ...it,
                    status: 'failed',
                    errorMessage: err instanceof Error ? err.message : '导入失败',
                  }
                : it,
            ),
          );
        } finally {
          done++;
          setCompletedCount(done);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
    await Promise.all(workers);
    invalidateDynamicContent();
    setImporting(false);
  };

  const retrySingle = async (itemIdx: number) => {
    const item = items[itemIdx];
    if (!item) return;

    setItems((prev) =>
      prev.map((it, i) =>
        i === itemIdx ? { ...it, status: 'uploading', errorMessage: undefined } : it,
      ),
    );

    try {
      const tags = item.tagsString
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await importMarkdownNote({
        filename: item.name,
        content: item.content,
        overwrite: Boolean(item.overwrite),
        metadata: {
          title: item.title,
          summary: item.summary,
          category: item.category,
          tags,
          slug: item.slug,
          isFeatured: item.parsed.metadata.isFeatured,
          publishedAt: item.parsed.metadata.publishedAt,
          status: 'draft',
        },
      });

      invalidateDynamicContent();
      setItems((prev) =>
        prev.map((it, i) =>
          i === itemIdx
            ? {
                ...it,
                status: result.status,
                importedNote: result.note,
                message: result.message,
                errorMessage: result.status === 'failed' ? result.message : undefined,
              }
            : it,
        ),
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((it, i) =>
          i === itemIdx
            ? {
                ...it,
                status: 'failed',
                errorMessage: err instanceof Error ? err.message : '重试失败',
              }
            : it,
        ),
      );
    }
  };

  return (
    <div className="page-canvas knowledge-import-canvas">
      <DraftingGridBackdrop />
      <Container>
        <header className="knowledge-shell__heading" style={{ marginBottom: '2rem' }}>
          <div className="knowledge-shell__meta">
            <span>WORKSPACE // 0x05</span>
            <span className="knowledge-shell__sep">·</span>
            <span>文档导入</span>
          </div>
          <h1>导入 Markdown 笔记</h1>
          <p className="knowledge-overview__intro">
            支持完整导入表格、代码块、列表与链接。所见即所存，严格保证排版一致性。
          </p>
          <nav className="knowledge-page-actions" aria-label="快捷入口">
            <Link className="knowledge-button knowledge-button--quiet" to="/knowledge/notes">
              ← 返回笔记列表
            </Link>
          </nav>
        </header>

        {/* Step Indicator */}
        <div className="knowledge-import-steps" role="tablist" aria-label="导入进度">
          <div className={`knowledge-import-step ${step === 'select' ? 'is-active' : ''}`}>
            <span className="step-num">1</span> 选择文件
          </div>
          <div className={`knowledge-import-step ${step === 'inspect' ? 'is-active' : ''}`}>
            <span className="step-num">2</span> 检查排版与元数据
          </div>
          <div className={`knowledge-import-step ${step === 'complete' ? 'is-active' : ''}`}>
            <span className="step-num">3</span> 批量保存
          </div>
        </div>

        {/* STEP 1: Select files */}
        {step === 'select' ? (
          <section className="knowledge-import-dropzone-section">
            <div
              className={`knowledge-import-dropzone ${dragActive ? 'is-drag-active' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              aria-label="拖拽或点击上传 Markdown 文件"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md,.markdown,.txt"
                style={{ display: 'none' }}
                onChange={onFileInputChange}
              />
              <div className="dropzone-icon" aria-hidden="true">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="12" y2="12" />
                  <line x1="15" y1="15" x2="12" y2="12" />
                </svg>
              </div>
              <h3>拖拽 Markdown 文件到此处，或点击浏览</h3>
              <p>支持 .md, .markdown, .txt；支持 UTF-8 及 UTF-8 BOM，中文无乱码。</p>
            </div>

            {items.length > 0 ? (
              <div className="knowledge-import-filelist">
                <h4>已选择 {items.length} 个文件：</h4>
                <ul>
                  {items.map((it) => (
                    <li key={it.id}>
                      <strong>{it.name}</strong> ({Math.round(it.sizeBytes / 1024)} KB) — 识别标题：
                      {it.title}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="knowledge-button knowledge-button--primary"
                    onClick={() => setStep('inspect')}
                  >
                    下一步：检查内容与排版
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* STEP 2: Inspect content and preview */}
        {step === 'inspect' && activeItem ? (
          <section className="knowledge-import-inspect">
            {/* Mobile View Toggle */}
            <div className="knowledge-import-mobile-toggle">
              <button
                type="button"
                className={`knowledge-button ${mobileView === 'info' ? 'knowledge-button--primary' : 'knowledge-button--quiet'}`}
                onClick={() => setMobileView('info')}
              >
                文档信息
              </button>
              <button
                type="button"
                className={`knowledge-button ${mobileView === 'preview' ? 'knowledge-button--primary' : 'knowledge-button--quiet'}`}
                onClick={() => setMobileView('preview')}
              >
                真实排版预览
              </button>
            </div>

            {/* Multiple files selector pills */}
            {items.length > 1 ? (
              <div className="knowledge-import-pills" role="tablist" aria-label="文件选择">
                {items.map((it, idx) => (
                  <button
                    key={it.id}
                    type="button"
                    className={`knowledge-button ${idx === activeItemIndex ? 'knowledge-button--secondary' : 'knowledge-button--quiet'}`}
                    onClick={() => setActiveItemIndex(idx)}
                  >
                    {it.name}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="knowledge-import-split">
              {/* Left Column: Metadata & Warnings */}
              <aside
                className={`knowledge-import-meta-panel ${mobileView === 'info' ? 'is-visible' : ''}`}
              >
                <div className="knowledge-import-card">
                  <h3>文档元数据</h3>
                  <label className="knowledge-editor__field">
                    <span>文章标题</span>
                    <input
                      type="text"
                      value={activeItem.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((it, i) => (i === activeItemIndex ? { ...it, title: val } : it)),
                        );
                      }}
                    />
                  </label>

                  <label className="knowledge-editor__field">
                    <span>摘要</span>
                    <textarea
                      rows={3}
                      value={activeItem.summary}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((it, i) =>
                            i === activeItemIndex ? { ...it, summary: val } : it,
                          ),
                        );
                      }}
                    />
                  </label>

                  <label className="knowledge-editor__field">
                    <span>分类</span>
                    <input
                      type="text"
                      value={activeItem.category}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((it, i) =>
                            i === activeItemIndex ? { ...it, category: val } : it,
                          ),
                        );
                      }}
                    />
                  </label>

                  <label className="knowledge-editor__field">
                    <span>标签 (逗号分隔)</span>
                    <input
                      type="text"
                      value={activeItem.tagsString}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((it, i) =>
                            i === activeItemIndex ? { ...it, tagsString: val } : it,
                          ),
                        );
                      }}
                    />
                  </label>

                  <label className="knowledge-editor__field">
                    <span>链接标识 (Slug)</span>
                    <input
                      type="text"
                      value={activeItem.slug}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((it, i) =>
                            i === activeItemIndex ? { ...it, slug: val } : it,
                          ),
                        );
                      }}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '1rem',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(activeItem.overwrite)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setItems((prev) =>
                          prev.map((it, i) =>
                            i === activeItemIndex ? { ...it, overwrite: checked } : it,
                          ),
                        );
                      }}
                    />
                    <span>若文章已存在则覆盖更新（默认跳过）</span>
                  </label>
                </div>

                {/* Compatibility Warnings */}
                {activeItem.parsed.warnings.length > 0 ? (
                  <div className="knowledge-import-card knowledge-import-warnings">
                    <h4>兼容性提示 ({activeItem.parsed.warnings.length})</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                      以下内容在转换时已安全处理，请核对是否符合预期：
                    </p>
                    <ul>
                      {activeItem.parsed.warnings.map((w, wIdx) => (
                        <li key={`warn-${wIdx}`}>
                          <span className="warning-type">[{w.type}]</span> {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div
                    className="knowledge-import-card"
                    style={{ background: 'rgba(52, 199, 89, 0.08)' }}
                  >
                    <p style={{ color: '#28a745', fontWeight: 600, margin: 0 }}>
                      ✓ 语法完全兼容（表格、代码块、引用均保留）
                    </p>
                  </div>
                )}

                <div className="knowledge-import-meta-actions">
                  <button
                    type="button"
                    className="knowledge-button knowledge-button--quiet"
                    onClick={() => setStep('select')}
                  >
                    重新选文件
                  </button>
                  <button
                    type="button"
                    className="knowledge-button knowledge-button--primary"
                    onClick={runBatchImport}
                  >
                    导入为草稿 ({items.length} 篇)
                  </button>
                </div>
              </aside>

              {/* Right Column: True Article Reading Preview */}
              <div
                className={`knowledge-import-preview-panel ${mobileView === 'preview' ? 'is-visible' : ''}`}
              >
                <article className="post-detail" style={{ padding: 0 }}>
                  <header className="post-detail__header" style={{ paddingBottom: '1.5rem' }}>
                    <div className="post-detail__intro">
                      <p className="eyebrow">Import Preview</p>
                      <h1>{activeItem.title}</h1>
                      <p className="post-detail__summary">{activeItem.summary}</p>
                      <div className="post-meta">
                        <span className="post-meta__category">{activeItem.category}</span>
                        <span className="post-meta__divider">·</span>
                        <span>{activeItem.tagsString || '无标签'}</span>
                      </div>
                    </div>
                  </header>

                  <div className="post-detail__layout" style={{ marginTop: '1.5rem' }}>
                    <aside className="post-detail__toc">
                      <TableOfContents
                        headings={extractHeadingsFromDocument(activeItem.parsed.document)}
                      />
                    </aside>
                    <div className="markdown-body">
                      <TiptapRenderer content={activeItem.parsed.document} />
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>
        ) : null}

        {/* STEP 3: Complete / Batch progress */}
        {step === 'complete' ? (
          <section className="knowledge-import-complete">
            <div className="knowledge-import-card">
              <h3>
                {importing
                  ? `正在导入… (已完成 ${completedCount} / ${items.length} 个文件)`
                  : '导入完成'}
              </h3>

              <div className="knowledge-import-results-list">
                {items.map((it, idx) => (
                  <div key={it.id} className="knowledge-import-result-row">
                    <div className="result-row__title">
                      <strong>{it.title}</strong>
                      <small style={{ color: 'var(--color-muted)', marginLeft: '0.75rem' }}>
                        {it.name}
                      </small>
                    </div>

                    <div className="result-row__status">
                      {it.status === 'uploading' ? <span>正在保存…</span> : null}
                      {it.status === 'imported' ? (
                        <span className="knowledge-badge knowledge-badge--published">
                          {it.message || '导入成功'}
                        </span>
                      ) : null}
                      {it.status === 'skipped' ? (
                        <span className="knowledge-badge knowledge-badge--draft">
                          {it.message || '已跳过 (已存在)'}
                        </span>
                      ) : null}
                      {it.status === 'failed' ? (
                        <span className="knowledge-badge knowledge-badge--archived">
                          失败: {it.errorMessage}
                        </span>
                      ) : null}
                    </div>

                    <div className="result-row__actions">
                      {it.importedNote ? (
                        <>
                          <Link
                            className="knowledge-button knowledge-button--quiet"
                            to={`/knowledge/notes/${it.importedNote.id}/read`}
                          >
                            阅读文章
                          </Link>
                          <Link
                            className="knowledge-button knowledge-button--secondary"
                            to={`/knowledge/notes/${it.importedNote.id}`}
                          >
                            去编辑
                          </Link>
                        </>
                      ) : null}
                      {it.status === 'failed' ? (
                        <button
                          type="button"
                          className="knowledge-button knowledge-button--secondary"
                          onClick={() => retrySingle(idx)}
                        >
                          重试
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {!importing ? (
                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    className="knowledge-button knowledge-button--primary"
                    onClick={() => navigate('/knowledge/notes')}
                  >
                    进入文章列表
                  </button>
                  <button
                    type="button"
                    className="knowledge-button knowledge-button--quiet"
                    onClick={() => {
                      setItems([]);
                      setStep('select');
                    }}
                  >
                    继续导入其他文件
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </Container>
    </div>
  );
}
