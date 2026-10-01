import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorPresentationState } from '../knowledge-ui/EditorPage';

type Options = {
  enabled: boolean;
  paused?: boolean;
  value: string;
  persistedValue: string;
  save: (
    snapshot: string,
    signal: AbortSignal,
  ) => Promise<void | { persistedValue: string; value: string }>;
  onPersisted: (snapshot: string) => void;
  delay?: number;
};

export function useNoteAutosave({
  enabled,
  paused = false,
  value,
  persistedValue,
  save,
  onPersisted,
  delay = 1500,
}: Options) {
  const latest = useRef(value);
  const acknowledged = useRef(persistedValue);
  const externalAcknowledged = useRef(persistedValue);
  const active = useRef<Promise<boolean> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const disposed = useRef(false);
  const failedSnapshot = useRef<string | null>(null);
  const [state, setState] = useState<EditorPresentationState>('unchanged');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [generation, setGeneration] = useState(0);
  latest.current = value;
  if (externalAcknowledged.current !== persistedValue) {
    externalAcknowledged.current = persistedValue;
    acknowledged.current = persistedValue;
  }

  const saveOnce = useCallback((): Promise<boolean> => {
    if (active.current) return active.current;
    if (!enabled || disposed.current) return Promise.resolve(false);
    if (latest.current === acknowledged.current) return Promise.resolve(true);
    const snapshot = latest.current;
    const abort = new AbortController();
    controller.current = abort;
    setState('saving');
    const request = (async () => {
      try {
        const result = await save(snapshot, abort.signal);
        if (disposed.current || abort.signal.aborted) return false;
        // An old response cannot replace local edits, but it DID change the server.
        failedSnapshot.current = null;
        acknowledged.current = result?.persistedValue ?? snapshot;
        if (result) latest.current = result.value;
        onPersisted(acknowledged.current);
        setLastSavedAt(new Date());
        setState(acknowledged.current === latest.current ? 'saved' : 'unsaved');
        return true;
      } catch {
        if (!disposed.current && !abort.signal.aborted) {
          failedSnapshot.current = snapshot;
          setState(snapshot === latest.current ? 'failed' : 'unsaved');
        }
        return false;
      } finally {
        active.current = null;
        if (!disposed.current && snapshot !== latest.current) setGeneration((n) => n + 1);
      }
    })();
    active.current = request;
    return request;
  }, [enabled, onPersisted, save]);

  const saveCurrent = useCallback(async (): Promise<boolean> => {
    if (!enabled || disposed.current) return false;
    // Always settle an earlier write before checking whether the latest text is saved.
    while (!disposed.current) {
      if (active.current) {
        if (!(await active.current)) return false;
      } else if (latest.current === acknowledged.current) {
        return true;
      } else if (!(await saveOnce())) {
        return false;
      }
    }
    return false;
  }, [enabled, saveOnce]);

  useEffect(() => {
    if (!enabled || paused || value === acknowledged.current || value === failedSnapshot.current)
      return;
    if (active.current) return;
    setState('unsaved');
    const timer = window.setTimeout(() => {
      void saveOnce();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, enabled, paused, value, persistedValue, generation, saveOnce]);

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      controller.current?.abort();
    };
  }, []);
  return { dirty: enabled && value !== acknowledged.current, state, saveCurrent, lastSavedAt };
}
