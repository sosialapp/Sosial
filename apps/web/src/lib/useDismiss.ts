'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Close a popover when the pointer goes down outside its element(s) or
 * Escape is pressed. Uses `pointerdown` so mouse, touch and pen all behave
 * the same. Accepts one ref or many (e.g. a trigger + a portaled panel).
 */
export function useDismiss(
  refs: RefObject<HTMLElement | null> | Array<RefObject<HTMLElement | null>>,
  open: boolean,
  close: () => void,
) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const list = Array.isArray(refs) ? refs : [refs];
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (list.some((r) => r.current?.contains(target))) return;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
