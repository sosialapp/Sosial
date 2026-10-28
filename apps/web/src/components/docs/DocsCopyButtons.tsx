'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Adds a Copy button to every code block in the rendered docs body. The
 *  body is server HTML, so the buttons are attached after hydration;
 *  `watch` re-attaches them after the HTML changes (the editor preview). */
export default function DocsCopyButtons({ rootId = 'docs-body', watch }: { rootId?: string; watch?: unknown }) {
  const path = usePathname();
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const added: HTMLButtonElement[] = [];
    root.querySelectorAll<HTMLElement>('.docs-code').forEach((block) => {
      if (block.querySelector('.docs-copy')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'docs-copy';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        const text = block.querySelector('code')?.textContent ?? '';
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = 'Copied';
        } catch {
          btn.textContent = 'Failed';
        }
        setTimeout(() => (btn.textContent = 'Copy'), 1500);
      });
      block.appendChild(btn);
      added.push(btn);
    });
    return () => added.forEach((b) => b.remove());
  }, [rootId, path, watch]);
  return null;
}
