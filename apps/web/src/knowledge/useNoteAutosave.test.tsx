import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNoteAutosave } from './useNoteAutosave';

afterEach(() => vi.useRealTimers());

describe('server-acknowledged draft saves', () => {
  it('writes the original content back after an in-flight edit is undone', async () => {
    vi.useFakeTimers();
    let complete!: () => void;
    let server = 'A';
    const save = vi.fn(
      (snapshot: string) =>
        new Promise<void>((resolve) => {
          complete = () => {
            server = snapshot;
            resolve();
          };
        }),
    );
    const { result, rerender } = renderHook(
      ({ value }) => {
        const [persisted, setPersisted] = useState('A');
        return useNoteAutosave({
          enabled: true,
          value,
          persistedValue: persisted,
          save,
          onPersisted: setPersisted,
        });
      },
      { initialProps: { value: 'A' } },
    );
    rerender({ value: 'B' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    rerender({ value: 'A' });
    await act(async () => {
      complete();
    });
    expect(result.current.dirty).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      complete();
    });
    expect(server).toBe('A');
    expect(result.current.dirty).toBe(false);
  });

  it('manual flush waits for in-flight writes before deciding the original value is saved', async () => {
    vi.useFakeTimers();
    const completions: Array<() => void> = [];
    let server = 'A';
    const save = vi.fn(
      (snapshot: string) =>
        new Promise<void>((resolve) => {
          completions.push(() => {
            server = snapshot;
            resolve();
          });
        }),
    );
    const { result, rerender } = renderHook(
      ({ value }) => {
        const [persisted, setPersisted] = useState('A');
        return useNoteAutosave({
          enabled: true,
          value,
          persistedValue: persisted,
          save,
          onPersisted: setPersisted,
        });
      },
      { initialProps: { value: 'A' } },
    );
    rerender({ value: 'B' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    rerender({ value: 'A' });
    let flushed: Promise<boolean>;
    act(() => {
      flushed = result.current.saveCurrent();
    });
    await act(async () => {
      completions.shift()!();
    });
    expect(save).toHaveBeenCalledTimes(2);
    await act(async () => {
      completions.shift()!();
      expect(await flushed!).toBe(true);
    });
    expect(server).toBe('A');
  });
});

describe('failed and abandoned writes', () => {
  it('does not implicitly retry a failed manual write when an operation unpauses', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    const onPersisted = vi.fn();
    const { result, rerender } = renderHook(
      ({ paused }) =>
        useNoteAutosave({
          enabled: true,
          paused,
          value: 'B',
          persistedValue: 'A',
          save,
          onPersisted,
        }),
      { initialProps: { paused: true } },
    );
    await act(async () => {
      expect(await result.current.saveCurrent()).toBe(false);
    });
    rerender({ paused: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.dirty).toBe(true);
  });
  it('aborts unmounted writes and never acknowledges a late result', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    let requestSignal!: AbortSignal;
    const save = vi.fn((_snapshot: string, signal: AbortSignal) => {
      requestSignal = signal;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    const onPersisted = vi.fn();
    const { unmount } = renderHook(() =>
      useNoteAutosave({ enabled: true, value: 'B', persistedValue: 'A', save, onPersisted }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    unmount();
    expect(requestSignal.aborted).toBe(true);
    await act(async () => {
      finish();
    });
    expect(onPersisted).not.toHaveBeenCalled();
  });
});
