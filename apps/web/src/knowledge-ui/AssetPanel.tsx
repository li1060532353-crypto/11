import { useEffect, useRef, useState } from 'react';

import type { EditorAsset } from './editor-fixtures';

export type AssetPanelProps = {
  assets: readonly EditorAsset[];
  onUpload?: ((file: File) => void) | undefined;
  onDownload?: ((assetId: string) => void) | undefined;
  onDelete?: ((assetId: string) => void) | undefined;
  onInsert?: ((asset: EditorAsset) => void) | undefined;
  onRetry?: ((asset: EditorAsset) => void) | undefined;
  unavailableMessage?: string | undefined;
  boundaryMessage?: string | undefined;
};

const isImageAsset = (asset: EditorAsset): boolean =>
  asset.mimeType
    ? /^image\/(png|jpeg|webp|gif)$/.test(asset.mimeType)
    : /\.(png|jpe?g|webp|gif)$/i.test(asset.name);

export function AssetPanel({
  assets,
  onUpload,
  onDownload,
  onDelete,
  onInsert,
  onRetry,
  unavailableMessage,
  boundaryMessage,
}: AssetPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<EditorAsset | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement | null>(null);
  const confirmButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (pendingDelete) {
      cancelButton.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current.focus();
      restoreFocus.current = null;
    }
  }, [pendingDelete]);

  const openDelete = (asset: EditorAsset) => {
    restoreFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingDelete(asset);
  };

  const closeDelete = () => setPendingDelete(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (onUpload) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActiveFalse();
  };

  const setIsDragActiveFalse = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!onUpload) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file) onUpload(file);
    }
  };

  return (
    <aside
      className={`knowledge-asset-panel ${isDragOver ? 'is-drag-over' : ''}`}
      aria-labelledby="knowledge-attachments-heading"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="knowledge-editor__section-heading">
        <div>
          <p className="knowledge-shell__eyebrow">FILES // 0x0A</p>
          <h2 id="knowledge-attachments-heading">附件资源</h2>
        </div>
        <label className="knowledge-upload-button" htmlFor="knowledge-asset-upload">
          附件上传
          <input
            id="knowledge-asset-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && onUpload) onUpload(file);
              event.currentTarget.value = '';
            }}
            disabled={!onUpload}
          />
        </label>
      </div>

      <p className="knowledge-asset-panel__boundary">
        {boundaryMessage ??
          '上传的资源附件供当前文章管理与正文引用使用。支持 PNG, JPG, WebP, GIF, PDF (≤15MB)。'}
      </p>

      {unavailableMessage ? (
        <div className="knowledge-asset-panel__error" role="alert">
          <span className="knowledge-asset-panel__error-icon">⚠</span>
          <p className="knowledge-message knowledge-message--error">{unavailableMessage}</p>
        </div>
      ) : null}

      {!unavailableMessage && assets.length === 0 ? (
        <p className="knowledge-empty-state">暂无附件</p>
      ) : (
        <ul className="knowledge-asset-list">
          {assets.map((asset) => {
            const isImg = isImageAsset(asset);
            return (
              <li
                className={`knowledge-asset-row ${asset.state === 'error' ? 'knowledge-asset-row--error' : ''}`}
                key={asset.id}
              >
                <div className="knowledge-asset-row__info">
                  <strong>{asset.name}</strong>
                  <span>{asset.sizeLabel}</span>
                </div>

                {asset.state === 'uploading' ? (
                  <div className="knowledge-asset-row__uploading">
                    <progress
                      aria-label={`正在上传 ${asset.name}`}
                      value={asset.progress ?? 0}
                      max={100}
                    >
                      {asset.progress ?? 0}%
                    </progress>
                    <span role="status">上传中…</span>
                  </div>
                ) : null}

                {asset.state === 'ready' ? (
                  <>
                    <span className="knowledge-asset-row__actions">
                      <span className="knowledge-asset-state">就绪</span>
                      {onInsert ? (
                        <button
                          type="button"
                          className="knowledge-button knowledge-button--quiet knowledge-button--small"
                          onClick={() => onInsert(asset)}
                          disabled={!!asset.busy}
                          title={isImg ? '在当前光标处插入图片节点' : '在当前光标处插入附件超链接'}
                        >
                          {isImg ? '插入图片' : '插入附件'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="knowledge-button knowledge-button--quiet knowledge-button--small"
                        onClick={() => onDownload?.(asset.id)}
                        disabled={!onDownload || !!asset.busy}
                        aria-label={`下载 ${asset.name}`}
                      >
                        下载 {asset.name}
                      </button>
                      <button
                        type="button"
                        className="knowledge-button knowledge-button--danger knowledge-button--small"
                        onClick={() => openDelete(asset)}
                        disabled={!onDelete || !!asset.busy}
                        aria-label={`删除 ${asset.name}`}
                      >
                        删除 {asset.name}
                      </button>
                    </span>
                    {asset.errorMessage ? (
                      <p role="alert" className="knowledge-message knowledge-message--error">
                        {asset.errorMessage}
                      </p>
                    ) : null}
                  </>
                ) : null}

                {asset.state === 'error' ? (
                  <div className="knowledge-asset-row__error-wrap">
                    <p role="alert" className="knowledge-message knowledge-message--error">
                      {asset.errorMessage ?? '上传失败，请重试'}
                    </p>
                    <div className="knowledge-asset-row__error-actions">
                      <button
                        type="button"
                        className="knowledge-button knowledge-button--quiet knowledge-button--small"
                        onClick={() => {
                          if (asset.file && onUpload) {
                            onUpload(asset.file);
                          } else if (onRetry) {
                            onRetry(asset);
                          } else {
                            const input = document.getElementById(
                              'knowledge-asset-upload',
                            ) as HTMLInputElement;
                            input?.click();
                          }
                        }}
                        aria-label={`重试上传 ${asset.name}`}
                      >
                        重试
                      </button>
                      <button
                        type="button"
                        className="knowledge-button knowledge-button--quiet knowledge-button--small"
                        onClick={() => onDelete?.(asset.id)}
                        aria-label={`移除 ${asset.name}`}
                      >
                        移除
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {pendingDelete ? (
        <div className="knowledge-dialog-backdrop">
          <section
            className="knowledge-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="knowledge-delete-heading"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeDelete();
              if (
                event.key === 'Tab' &&
                event.shiftKey &&
                document.activeElement === cancelButton.current
              ) {
                event.preventDefault();
                confirmButton.current?.focus();
              }
              if (
                event.key === 'Tab' &&
                !event.shiftKey &&
                document.activeElement === confirmButton.current
              ) {
                event.preventDefault();
                cancelButton.current?.focus();
              }
            }}
          >
            <h2 id="knowledge-delete-heading">删除附件 {pendingDelete.name}</h2>
            <p>该附件将从本文章中彻底移除。</p>
            <div className="knowledge-dialog__actions">
              <button
                ref={cancelButton}
                type="button"
                className="knowledge-button knowledge-button--quiet"
                onClick={closeDelete}
              >
                取消
              </button>
              <button
                ref={confirmButton}
                type="button"
                className="knowledge-button knowledge-button--danger"
                onClick={() => {
                  onDelete?.(pendingDelete.id);
                  closeDelete();
                }}
              >
                确认删除
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
