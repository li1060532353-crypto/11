import { useLayoutEffect, useRef } from 'react';

export function useReaderNavigationOffset<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const canvas = element?.closest<HTMLElement>('.post-detail-canvas');
    if (!element || !canvas) return;
    const update = () => canvas.style.setProperty('--reader-navigation-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener('resize', update);
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); canvas.style.removeProperty('--reader-navigation-height'); };
  });
  return ref;
}
