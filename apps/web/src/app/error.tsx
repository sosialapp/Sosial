'use client';

import { useEffect } from 'react';

/** A script or stylesheet of this build failed to load: a deploy swapped the
 *  files under an open tab, or the network dropped the request. */
function isChunkError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      error.message ?? '',
    )
  );
}

const RELOAD_KEY = 'sosial-chunk-reload';

/** Root error boundary: what failed, what to do next, and a way back. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunk = isChunkError(error);

  // A missing chunk heals with a fresh page load (new HTML, new chunk names).
  // Once per minute at most, so a real outage never loops.
  useEffect(() => {
    if (!chunk) return;
    try {
      const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last < 60_000) return;
      window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      /* storage blocked: still reload once, the error view stays as the fallback */
    }
    window.location.reload();
  }, [chunk]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">Something broke</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
        {chunk ? 'Sosial was just updated.' : 'This page hit an error.'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {chunk
          ? 'Part of this page is from the previous version. Reload to get the latest.'
          : error.message || 'An unexpected error stopped this page from loading.'}{' '}
        Your posts and schedule are safe. Try again, or go back to the dashboard.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => (chunk ? window.location.reload() : reset())}
          className="btn btn-bolt"
        >
          {chunk ? 'Reload' : 'Try again'}
        </button>
        <a href="/dashboard" className="btn btn-ghost">
          Dashboard
        </a>
      </div>
    </div>
  );
}
