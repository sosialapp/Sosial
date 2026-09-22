'use client';

/** Root error boundary: what failed, what to do next, and a way back. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">Something broke</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
        This page hit an error.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {error.message || 'An unexpected error stopped this page from loading.'} Your posts and
        schedule are safe. Try again, or go back to the dashboard.
      </p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={reset} className="btn btn-bolt">
          Try again
        </button>
        <a href="/dashboard" className="btn btn-ghost">
          Dashboard
        </a>
      </div>
    </div>
  );
}
