/** Instant skeleton while the hub's server data (posts, channels) loads. */
export default function Loading() {
  return (
    <div className="w-full px-4 pt-6 sm:px-6" aria-hidden="true">
      <p className="eyebrow">Post</p>
      <div className="mt-1 h-8 w-48 animate-pulse rounded-lg bg-line-soft" />
      <div className="mt-4 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-line-soft" />
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-3xl border border-line bg-card p-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-line-soft" />
              <div className="h-4 flex-1 rounded bg-line-soft" />
            </div>
            <div className="mt-3 h-4 w-3/4 rounded bg-line-soft" />
            <div className="mt-2 h-40 rounded-2xl bg-line-soft" />
          </div>
        ))}
      </div>
    </div>
  );
}
