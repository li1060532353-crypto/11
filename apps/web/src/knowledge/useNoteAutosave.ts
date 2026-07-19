import { useCallback, useEffect, useRef, useState } from 'react';

import type { EditorPresentationState } from '../knowledge-ui/EditorPage';

type Options = { enabled: boolean; value: string; persistedValue: string; save: (snapshot: string, signal: AbortSignal) => Promise<void>; onPersisted: (snapshot: string) => void; delay?: number };

export function useNoteAutosave({ enabled, value, persistedValue, save, onPersisted, delay = 1500 }: Options) {
  const valueRef = useRef(value);
  const persistedRef = useRef(persistedValue);
  const activeRef = useRef<Promise<boolean> | null>(null);
  const disposedRef = useRef(false);
  const [state, setState] = useState<EditorPresentationState>('unchanged');
  const [rescheduleGeneration, setRescheduleGeneration] = useState(0);
  valueRef.current = value;
  persistedRef.current = persistedValue;
  const dirty = enabled && value !== persistedValue;

  const saveCurrent = useCallback(async (): Promise<boolean> => {
    if (!enabled || valueRef.current === persistedRef.current) { if (!disposedRef.current) setState('unchanged'); return true; }
    if (activeRef.current) { await activeRef.current; return saveCurrent(); }
    const snapshot = valueRef.current;
    const controller = new AbortController();
    const request = (async () => {
      if (!disposedRef.current) setState('saving');
      try {
        await save(snapshot, controller.signal);
        if (disposedRef.current || snapshot !== valueRef.current) return false;
        onPersisted(snapshot);
        if (!disposedRef.current) setState('saved');
        return true;
      } catch {
        if (!disposedRef.current && snapshot === valueRef.current) setState('failed');
        return false;
      } finally {
        activeRef.current = null;
        if (!disposedRef.current && snapshot !== valueRef.current) { setState('unsaved'); setRescheduleGeneration((generation) => generation + 1); }
      }
    })();
    activeRef.current = request;
    return request;
  }, [enabled, onPersisted, save]);

  useEffect(() => {
    disposedRef.current = false;
    if (!enabled) { setState('unchanged'); return; }
    if (value === persistedValue) return;
    if (activeRef.current) { setState('unsaved'); return; }
    setState('unsaved');
    const timer = window.setTimeout(() => { void saveCurrent(); }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, enabled, persistedValue, rescheduleGeneration, saveCurrent, value]);
  useEffect(() => () => { disposedRef.current = true; }, []);
  return { dirty, state, saveCurrent };
}
