'use client';

import { useEffect } from 'react';

/**
 * Hydrates the empty <figure class="sosial-chart" data-chart="…"> placeholders
 * the blog serializer emits. Server HTML ships the data; only the drawing
 * happens client-side (charts are visual, all text stays in the HTML). The
 * chart code (recharts) is imported only when the page has such a figure.
 */
export default function ChartIslands() {
  useEffect(() => {
    const figures = Array.from(
      document.querySelectorAll<HTMLElement>('.sosial-chart[data-chart]:not([data-ready])'),
    );
    if (!figures.length) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void import('./ChartIslandsRender').then(({ renderChartIslands }) => {
      if (!cancelled) cleanup = renderChartIslands(figures);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);
  return null;
}
