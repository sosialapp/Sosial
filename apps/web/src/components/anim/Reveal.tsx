'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Staggered scroll-in for a group of children.
 *
 * Progressive enhancement: nothing is hidden in the markup, so the content is
 * fully readable with JavaScript disabled, before hydration, and for anyone
 * who prefers reduced motion. The effect only *adds* the entrance, with plain
 * inline transitions driven by one IntersectionObserver.
 */
export default function Reveal({
  children,
  className,
  y = 26,
  stagger = 0.08,
  delay = 0,
  start = 'top 88%',
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  stagger?: number;
  delay?: number;
  start?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.children) as HTMLElement[];
    if (!items.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    // "top 88%" means the group starts when its top reaches 88% of the
    // viewport; pull the observer's bottom edge up by the remaining 12%.
    const pct = Number.parseFloat(start.trim().split(/\s+/).pop()?.replace('%', '') ?? '');
    const bottom = Number.isFinite(pct) ? 100 - pct : 12;

    items.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = `translateY(${y}px)`;
      el.style.willChange = 'opacity, transform';
    });

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        items.forEach((el, i) => {
          const wait = delay + i * stagger;
          el.style.transition = `opacity 0.66s cubic-bezier(0.22, 1, 0.36, 1) ${wait}s, transform 0.66s cubic-bezier(0.22, 1, 0.36, 1) ${wait}s`;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          // Hand transform back to the element's own CSS once settled, so a
          // hover lift on a revealed child is not pinned to translateY(0).
          el.addEventListener(
            'transitionend',
            () => {
              el.style.willChange = '';
              el.style.transition = '';
              el.style.opacity = '';
              el.style.transform = '';
            },
            { once: true },
          );
        });
      },
      { rootMargin: `0px 0px -${bottom}% 0px` },
    );
    observer.observe(root);

    return () => observer.disconnect();
  }, [y, stagger, delay, start]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}