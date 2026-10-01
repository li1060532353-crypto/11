import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSpotlight } from './useSpotlight';

describe('useSpotlight', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useSpotlight());
    expect(result.current.isOpen).toBe(false);
  });

  it('opens and closes via function calls', () => {
    const { result } = renderHook(() => useSpotlight());

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('toggles open state with Cmd+K or Ctrl+K shortcut', () => {
    const { result } = renderHook(() => useSpotlight());

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    expect(result.current.isOpen).toBe(false);
  });
});
