import { useCallback, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
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

export type FileItem = {
  id: string;
  name: string;
  sizeBytes: number;
  content: string;
  file?: File;
  parsed: MarkdownConversionResult | null;
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
  isDuplicate: boolean;
};

export type Step = 'select' | 'inspect' | 'complete';

export function KnowledgeImportRoute() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formIdPrefix = useId();
  const [step, setStep] = useState<Step>('select');
  const [items, setItems] = useState<FileItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [mobileView, setMobileView] = useState<'info' | 'preview'>('info');
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const activeItem = items[activeItemIndex];

  // Helper to safely parse markdown content
  const parseContentSafely = useCallback((content: string, filename: string): MarkdownConversionResult => {
    // Check for corrupted or non-text characters
    if (content.includes('\0')) {
      throw new Error('Markdown 结构解析失败: 文件包含非法不可解析字符');
    }
    // Check for malformed / unclosed YAML frontmatter
    if (/^---\r?\n/.test(content) && !/^---\r?\n[\s\S]*?\r?\n---\r?\n?/.test(content)) {
      throw new Error('YAML frontmatter 解析失败: 未闭合的 FrontMatter 区块');
    }

    return parseMarkdownToTiptap(content, filename);
  }, []);

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((file) =>
      /\.(?:md|markdown|txt)$/i.test(file.name),
    );

    if (validFiles.length === 0) return;

    // Detect duplicate file names in incoming batch
    const filenameCounts = new Map<string, number>();
    for (const f of validFiles) {
      filenameCounts.set(f.name, (filenameCounts.get(f.name) ?? 0) + 1);
    }

    const readFilePromise = (file: File): Promise<FileItem> => {
      const baseName = file.name.replace(/\.(?:md|markdown|txt)$/i, '');
      const defaultSlug = baseName.toLowerCase().replace(/[^\p{Letter}\p{Number}\s-]/gu, '').trim().replace(/[\s-]+/gu, '-') || 'note';
      const isDuplicate = (filenameCounts.get(file.name) ?? 0) > 1;

      const baseItem: Omit<FileItem, 'parsed' | 'status' | 'errorMessage'> = {
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        sizeBytes: file.size,
        content: '',
        file,
        title: baseName,
        summary: '',
        category: '通用',
        tagsString: '',
        slug: defaultSlug,
        overwrite: false,
        isDuplicate,
      };

      return new Promise<FileItem>((resolve) => {
        let settled = false;
        const safeResolve = (item: FileItem) => {
          if (!settled) {
            settled = true;
            resolve(item);
          }
        };

        const onFileContent = (content: string) => {
          try {
            const parsed = parseContentSafely(content, file.name);
            safeResolve({
              ...baseItem,
              content,
              parsed,
              title: parsed.metadata.title || baseItem.title,
              summary: parsed.metadata.summary,
              category: parsed.metadata.category || '通用',
              tagsString: parsed.metadata.tags.join(', '),
              slug: parsed.metadata.slug || baseItem.slug,
              status: 'pending',
            });
          } catch (err) {
            let errorMsg = err instanceof Error ? err.message : 'Markdown 结构解析失败';
            if (/yaml|frontmatter/i.test(errorMsg) && !errorMsg.startsWith('YAML frontmatter')) {
              errorMsg = `YAML frontmatter 解析失败: ${errorMsg}`;
            }
            safeResolve({
              ...baseItem,
              content,
              parsed: null,
              status: 'failed',
              errorMessage: errorMsg,
            });
          }
        };

        const onFileError = (err?: DOMException | Error | null) => {
          safeResolve({
            ...baseItem,
            content: '',
            parsed: null,
            status: 'failed',
            errorMessage: err?.message ? `文件读取失败 (${err.message})` : '文件读取失败 (FileReader 异常)',
          });
        };

        try {
          if (typeof file.text === 'function') {
            file.text().then(onFileContent, onFileError);
          } else if (typeof FileReader !== 'undefined') {
            const reader = new FileReader();
            reader.onload = () => onFileContent(String(reader.result ?? ''));
            reader.onerror = () => onFileError(reader.error);
            reader.onabort = () => onFileError(new Error('文件读取被中止'));
            reader.readAsText(file, 'utf-8');
          } else {
            onFileError(new Error('FileReader not supported in environment'));
          }
        } catch (err) {
          onFileError(err instanceof Error ? err : null);
        }
      });
    };

    const reads = validFiles.map(readFilePromise);

    Promise.all(reads).then((newItems) => {
      // Check slug duplicate collisions across the batch
      const slugCounts = new Map<string, number>();
      for (const it of newItems) {
        if (it.slug) {
          slugCounts.set(it.slug, (slugCounts.get(it.slug) ?? 0) + 1);
        }
      }

      const finalItems = newItems.map((it) => {
        const hasDup = Boolean(it.isDuplicate || (it.slug && (slugCounts.get(it.slug) ?? 0) > 1));
        return hasDup ? { ...it, isDuplicate: true } : it;
      });

      setItems(finalItems);
      setStep('inspect');
      setActiveItemIndex(0);
    });
  }, [parseContentSafely]);

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

  // Execute import for a single item by index
  const executeItemImport = async (itemIdx: number): Promise<boolean> => {
    const item = items[itemIdx];
    if (!item) return false;

    let content = item.content;
    let parsed = item.parsed;
    let parseError: string | null = null;

    // If item was failed due to parse error, attempt re-parsing
    if (!parsed) {
      try {
        if (!content && item.file && typeof item.file.text === 'function') {
          content = await item.file.text();
        }
        parsed = parseContentSafely(content, item.name);
      } catch (err) {
        let msg = err instanceof Error ? err.message : 'Markdown 结构解析失败';
        if (/yaml|frontmatter/i.test(msg) && !msg.startsWith('YAML frontmatter')) {
          msg = `YAML frontmatter 解析失败: ${msg}`;
        }
        parseError = msg;
      }
    }

    if (!parsed || parseError) {
      setItems((prev) =>
        prev.map((it, i) =>
          i === itemIdx
            ? {
                ...it,
                content,
                status: 'failed',
                errorMessage: parseError || 'Markdown 结构解析失败',
              }
            : it,
        ),
      );
      return false;
    }

    // Set uploading state
    setItems((prev) =>
      prev.map((it, i) =>
        i === itemIdx ? { ...it, content, parsed, status: 'uploading', errorMessage: undefined } : it,
      ),
    );

    try {
      const tags = item.tagsString
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await importMarkdownNote({
        filename: item.name,
        content: content || item.content,
        overwrite: Boolean(item.overwrite),
        metadata: {
          title: item.title || parsed.metadata.title,
          summary: item.summary || parsed.metadata.summary,
          category: item.category || parsed.metadata.category || '通用',
          tags,
          slug: item.slug || parsed.metadata.slug,
          isFeatured: parsed.metadata.isFeatured,
          publishedAt: parsed.metadata.publishedAt,
          status: 'draft',
        },
      });

      setItems((prev) =>
        prev.map((it, i) =>
          i === itemIdx
            ? {
                ...it,
                status: result.status,
                importedNote: result.note,
                message: result.message,
                errorMessage: result.status === 'failed' ? result.message : undefined,
                isDuplicate: result.status === 'skipped' ? true : it.isDuplicate,
              }
            : it,
        ),
      );
      return result.status === 'imported';
    } catch (err) {
      let errorMsg = '导入失败';
      if (err instanceof Error) {
        errorMsg = err.message;
      }
      if (err && typeof err === 'object' && 'kind' in err) {
        const kind = (err as { kind: string }).kind;
        if (kind === 'network') errorMsg = '网络请求超时';
        else if (kind === 'repository') errorMsg = '服务器存储异常';
        else if (kind === 'validation') errorMsg = '数据校验未通过';
        else if (kind === 'conflict') errorMsg = '检测到重复文章，建议确认是否覆盖';
      }

      setItems((prev) =>
        prev.map((it, i) =>
          i === itemIdx
            ? {
                ...it,
                status: 'failed',
                errorMessage: errorMsg,
              }
            : it,
        ),
      );
      return false;
    }
  };

  // Step 3: Run batch import with concurrency 3
  const runBatchImport = async () => {
    setStep('complete');
    setImporting(true);
    setCompletedCount(0);

    const queueIndices = items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => it.status !== 'imported');

    const concurrency = 3;
    let queuePos = 0;
    let done = 0;

    const worker = async () => {
      while (queuePos < queueIndices.length) {
        const current = queueIndices[queuePos++];
        if (!current) break;
        const { it: item, idx: currentIdx } = current;

        // If item already failed during initial reading/parsing, keep as failed and proceed
        if (item.status === 'failed') {
          done++;
          setCompletedCount(done);
          continue;
        }

        await executeItemImport(currentIdx);
        done++;
        setCompletedCount(done);
      }
    };

    const workerCount = Math.min(concurrency, queueIndices.length || 1);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);
    invalidateDynamicContent();
    setImporting(false);
  };

  // Single item retry
  const retrySingle = async (itemIdx: number) => {
    setImporting(true);
    await executeItemImport(itemIdx);
    invalidateDynamicContent();
    setImporting(false);
  };

  // Retry with overwrite enabled
  const retryWithOverwrite = async (itemIdx: number) => {
    setItems((prev) =>
      prev.map((it, i) => (i === itemIdx ? { ...it, overwrite: true } : it)),
    );
    setImporting(true);
    // Directly run with overwrite set to true
    const item = items[itemIdx];
    if (item) {
      item.overwrite = true;
    }
    await executeItemImport(itemIdx);
    invalidateDynamicContent();
    setImporting(false);
  };

  // Retry ONLY failed items with concurrency <= 3
  const retryFailedOnly = async () => {
    const failedIndices = items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => it.status === 'failed');

    if (failedIndices.length === 0) return;

    setImporting(true);
    let done = 0;
    setCompletedCount(0);

    const concurrency = 3;
    let queuePos = 0;

    const worker = async () => {
      while (queuePos < failedIndices.length) {
        const current = failedIndices[queuePos++];
        if (!current) break;
        const { idx: currentIdx } = current;
        await executeItemImport(currentIdx);
        done++;
        setCompletedCount(done);
      }
    };

    const workerCount = Math.min(concurrency, failedIndices.length);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);
    invalidateDynamicContent();
    setImporting(false);
  };

  // Statistics for Step 3
  const successCount = items.filter((it) => it.status === 'imported').length;
  const failedCount = items.filter((it) => it.status === 'failed').length;
  const skippedCount = items.filter((it) => it.status === 'skipped').length;
  const hasDuplicateWarning = items.some((it) => it.isDuplicate || it.status === 'skipped');

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
                      {it.status === 'failed' ? (
                        <span style={{ color: '#dc2626', marginLeft: '0.5rem', fontWeight: 600 }}>
                          [解析失败: {it.errorMessage}]
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    className="knowledge-button knowledge-button--primary"
                    onClick={() => setStep('inspect')}
                  >
                    下一步：检查内容与排版
                  </button>
                  <button
                    type="button"
                    className="knowledge-button knowledge-button--secondary"
                    onClick={runBatchImport}
                  >
                    直接批量导入 ({items.filter((it) => it.status !== 'failed').length} 篇)
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
                    style={
                      it.status === 'failed'
                        ? { borderColor: '#ef4444', color: '#dc2626' }
                        : undefined
                    }
                    onClick={() => setActiveItemIndex(idx)}
                  >
                    {it.status === 'failed' ? '⚠ ' : ''}
                    {it.name}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Duplicate article warning banner */}
            {hasDuplicateWarning ? (
              <div
                className="knowledge-import-card knowledge-import-duplicate-banner"
                style={{
                  marginBottom: '1rem',
                  borderLeft: '4px solid #f59e0b',
                  background: 'rgba(245, 158, 11, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <span style={{ color: '#b45309', fontWeight: 600 }}>
                  ⚠ 检测到重复文章，建议确认是否覆盖
                </span>
                <button
                  type="button"
                  className="knowledge-button knowledge-button--quiet"
                  style={{ fontSize: '0.85rem' }}
                  onClick={() => {
                    setItems((prev) => prev.map((it) => ({ ...it, overwrite: true })));
                  }}
                >
                  全部开启覆盖
                </button>
              </div>
            ) : null}

            <div className="knowledge-import-split">
              {/* Left Column: Metadata & Warnings */}
              <aside
                className={`knowledge-import-meta-panel ${mobileView === 'info' ? 'is-visible' : ''}`}
              >
                <div className="knowledge-import-card">
                  <h3>文档元数据</h3>

                  {activeItem.status === 'failed' ? (
                    <div
                      className="knowledge-import-card knowledge-import-card--error"
                      style={{
                        marginBottom: '1rem',
                        borderLeft: '4px solid #ef4444',
                        background: 'rgba(239, 68, 68, 0.08)',
                        padding: '0.75rem 1rem',
                      }}
                    >
                      <h4 style={{ color: '#dc2626', margin: '0 0 0.5rem 0' }}>⚠ 该文件解析失败</h4>
                      <p style={{ color: '#dc2626', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
                        {activeItem.errorMessage || 'Markdown 结构解析失败'}
                      </p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: 0 }}>
                        批量导入时将隔离此错误并跳过此文件，不影响其余文件正常入库。
                      </p>
                    </div>
                  ) : null}

                  <label className="knowledge-editor__field" htmlFor={`${formIdPrefix}-title`}>
                    <span>文章标题</span>
                    <input
                      id={`${formIdPrefix}-title`}
                      type="text"
                      value={activeItem.title}
                      disabled={activeItem.status === 'failed'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((it, i) => (i === activeItemIndex ? { ...it, title: val } : it)),
                        );
                      }}
                    />
                  </label>

                  <label className="knowledge-editor__field" htmlFor={`${formIdPrefix}-summary`}>
                    <span>摘要</span>
                    <textarea
                      id={`${formIdPrefix}-summary`}
                      rows={3}
                      value={activeItem.summary}
                      disabled={activeItem.status === 'failed'}
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

                  <label className="knowledge-editor__field" htmlFor={`${formIdPrefix}-category`}>
                    <span>分类</span>
                    <input
                      id={`${formIdPrefix}-category`}
                      type="text"
                      value={activeItem.category}
                      disabled={activeItem.status === 'failed'}
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

                  <label className="knowledge-editor__field" htmlFor={`${formIdPrefix}-tags`}>
                    <span>标签 (逗号分隔)</span>
                    <input
                      id={`${formIdPrefix}-tags`}
                      type="text"
                      value={activeItem.tagsString}
                      disabled={activeItem.status === 'failed'}
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

                  <label className="knowledge-editor__field" htmlFor={`${formIdPrefix}-slug`}>
                    <span>链接标识 (Slug)</span>
                    <input
                      id={`${formIdPrefix}-slug`}
                      type="text"
                      value={activeItem.slug}
                      disabled={activeItem.status === 'failed'}
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
                    htmlFor={`${formIdPrefix}-overwrite`}
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
                      id={`${formIdPrefix}-overwrite`}
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

                {/* Compatibility Warnings or Status */}
                {activeItem.parsed && activeItem.parsed.warnings.length > 0 ? (
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
                ) : activeItem.status !== 'failed' ? (
                  <div
                    className="knowledge-import-card"
                    style={{ background: 'rgba(52, 199, 89, 0.08)' }}
                  >
                    <p style={{ color: '#28a745', fontWeight: 600, margin: 0 }}>
                      ✓ 语法完全兼容（表格、代码块、引用均保留）
                    </p>
                  </div>
                ) : null}

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
                    disabled={items.every((it) => it.status === 'failed')}
                  >
                    导入为草稿 ({items.filter((it) => it.status !== 'failed').length} 篇)
                  </button>
                </div>
              </aside>

              {/* Right Column: True Article Reading Preview */}
              <div
                className={`knowledge-import-preview-panel ${mobileView === 'preview' ? 'is-visible' : ''}`}
              >
                {activeItem.parsed ? (
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
                ) : (
                  <div
                    className="knowledge-import-error-preview"
                    style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-muted)' }}
                  >
                    <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#dc2626' }}>
                      无法渲染富文本预览：{activeItem.errorMessage || '文件解析失败'}
                    </p>
                    <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                      该文件无法被解析为规范的 Markdown。其余正常文件仍可继续正常导入。
                    </p>
                    {activeItem.content ? (
                      <pre
                        style={{
                          textAlign: 'left',
                          maxHeight: '320px',
                          overflow: 'auto',
                          background: 'var(--color-soft, #f5f5f7)',
                          padding: '1rem',
                          borderRadius: '0.5rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {activeItem.content}
                      </pre>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* STEP 3: Complete / Batch progress */}
        {step === 'complete' ? (
          <section className="knowledge-import-complete">
            <div className="knowledge-import-card">
              <h3 className="knowledge-import-complete-title">
                {importing
                  ? `正在导入… (已完成 ${completedCount} / ${items.length} 个文件)`
                  : `导入完成：${successCount} 篇成功，${failedCount} 篇失败，${skippedCount} 篇跳过`}
              </h3>

              {!importing ? (
                <div
                  className="knowledge-import-summary"
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'center',
                    marginBottom: '1.25rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span className="knowledge-badge knowledge-badge--published" style={{ fontWeight: 600 }}>
                    成功 {successCount} 篇
                  </span>
                  {failedCount > 0 ? (
                    <span
                      className="knowledge-badge knowledge-badge--archived"
                      style={{ fontWeight: 600, background: '#fee2e2', color: '#dc2626' }}
                    >
                      失败 {failedCount} 篇
                    </span>
                  ) : null}
                  {skippedCount > 0 ? (
                    <span className="knowledge-badge knowledge-badge--draft" style={{ fontWeight: 600 }}>
                      跳过 {skippedCount} 篇
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* Duplicate article warning in complete view */}
              {hasDuplicateWarning && !importing ? (
                <div
                  className="knowledge-import-card knowledge-import-duplicate-banner"
                  style={{
                    marginBottom: '1rem',
                    borderLeft: '4px solid #f59e0b',
                    background: 'rgba(245, 158, 11, 0.08)',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <p style={{ color: '#b45309', margin: 0, fontWeight: 600 }}>
                    ⚠ 检测到重复文章，建议确认是否覆盖
                  </p>
                </div>
              ) : null}

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
                        <span
                          className="knowledge-badge knowledge-badge--archived"
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            borderColor: '#fca5a5',
                            fontWeight: 600,
                          }}
                        >
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
                      {it.status === 'skipped' && !importing ? (
                        <button
                          type="button"
                          className="knowledge-button knowledge-button--secondary"
                          onClick={() => retryWithOverwrite(idx)}
                        >
                          覆盖导入
                        </button>
                      ) : null}
                      {it.status === 'failed' && !importing ? (
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
                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {failedCount > 0 ? (
                    <button
                      type="button"
                      className="knowledge-button knowledge-button--secondary knowledge-import-retry-failed-btn"
                      style={{ borderColor: '#ef4444', color: '#dc2626', fontWeight: 600 }}
                      onClick={retryFailedOnly}
                      aria-label="仅重试失败项"
                    >
                      仅重试失败项
                    </button>
                  ) : null}
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
