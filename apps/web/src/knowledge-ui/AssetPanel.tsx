import { useEffect, useRef, useState } from 'react';

import type { EditorAsset } from './editor-fixtures';

type AssetPanelProps = {
  assets: readonly EditorAsset[];
  onUpload?: ((file: File) => void) | undefined;
  onDownload?: ((assetId: string) => void) | undefined;
  onDelete?: ((assetId: string) => void) | undefined;
  unavailableMessage?: string | undefined;
};

export function AssetPanel({ assets, onUpload, onDownload, onDelete, unavailableMessage }: AssetPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<EditorAsset | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement | null>(null);
  const confirmButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (pendingDelete) cancelButton.current?.focus();
    else if (restoreFocus.current) { restoreFocus.current.focus(); restoreFocus.current = null; }
  }, [pendingDelete]);
  const openDelete = (asset: EditorAsset) => { restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setPendingDelete(asset); };
  const closeDelete = () => setPendingDelete(null);

  return (
    <aside className="knowledge-asset-panel" aria-labelledby="knowledge-attachments-heading">
      <div className="knowledge-editor__section-heading">
        <div><p className="knowledge-shell__eyebrow">Files</p><h2 id="knowledge-attachments-heading">Attachments</h2></div>
        <label className="knowledge-upload-button" htmlFor="knowledge-asset-upload">附件上传
          <input id="knowledge-asset-upload" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload?.(file); event.currentTarget.value = ''; }} disabled={!onUpload} />
        </label>
      </div>
      <p className="knowledge-asset-panel__boundary">Uploads shown here are for this editor session only. They are not embedded in this article or restored after a refresh.</p>
      {unavailableMessage ? <p className="knowledge-shell__subtle">{unavailableMessage}</p> : null}
      {assets.length === 0 ? <p className="knowledge-empty-state">No attachments yet</p> : (
        <ul className="knowledge-asset-list">
          {assets.map((asset) => (
            <li className="knowledge-asset-row" key={asset.id}>
              <div className="knowledge-asset-row__info"><strong>{asset.name}</strong><span>{asset.sizeLabel}</span></div>
              {asset.state === 'uploading' ? <><progress aria-label={`Uploading ${asset.name}`} value={asset.progress ?? 0} max={100}>{asset.progress ?? 0}%</progress><span role="status">Uploading</span></> : null}
              {asset.state === 'ready' ? <><span className="knowledge-asset-row__actions"><span className="knowledge-asset-state">Ready</span><button type="button" onClick={() => onDownload?.(asset.id)} disabled={!onDownload || !!asset.busy}>Download {asset.name}</button><button type="button" className="knowledge-danger-button" onClick={() => openDelete(asset)} disabled={!onDelete || !!asset.busy}>Delete {asset.name}</button></span>{asset.errorMessage ? <p role="alert" className="knowledge-message knowledge-message--error">{asset.errorMessage}</p> : null}</> : null}
              {asset.state === 'error' ? <p role="alert" className="knowledge-message knowledge-message--error">{asset.errorMessage ?? 'Upload failed'}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {pendingDelete ? (
        <div className="knowledge-dialog-backdrop">
          <section className="knowledge-dialog" role="dialog" aria-modal="true" aria-labelledby="knowledge-delete-heading" onKeyDown={(event) => { if (event.key === 'Escape') closeDelete(); if (event.key === 'Tab' && event.shiftKey && document.activeElement === cancelButton.current) { event.preventDefault(); confirmButton.current?.focus(); } if (event.key === 'Tab' && !event.shiftKey && document.activeElement === confirmButton.current) { event.preventDefault(); cancelButton.current?.focus(); } }}>
            <h2 id="knowledge-delete-heading">Delete {pendingDelete.name}</h2>
            <p>This attachment will be removed from the note.</p>
            <div className="knowledge-dialog__actions"><button ref={cancelButton} type="button" onClick={closeDelete}>Cancel</button><button ref={confirmButton} type="button" className="knowledge-danger-button" onClick={() => { onDelete?.(pendingDelete.id); closeDelete(); }}>Confirm delete</button></div>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
