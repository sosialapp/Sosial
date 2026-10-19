/**
 * Generic content skeleton shown while a workspace switch re-renders, or while
 * a route segment loads. Deliberately shape-agnostic: an eyebrow, a title and a
 * few card placeholders read as "your stuff is coming" for the queue, team,
 * analytics and channel pages alike, and match the bone/card/line palette.
 */
export default function PageSkeleton() {
  return (
    <div className="w-full px-4 pt-6 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-3 w-20 animate-pulse rounded-full bg-line-soft" />
      <div className="mt-3 h-7 w-44 animate-pulse rounded-lg bg-line-soft" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
          >
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-line-soft" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-line-soft" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-line-soft" />
            </div>
            <div className="hidden h-8 w-20 shrink-0 animate-pulse rounded-full bg-line-soft sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
