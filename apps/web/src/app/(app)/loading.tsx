/** Instant nav feedback — shown the moment a dock tap starts while the page SSR-fetches. */
export default function AppLoading() {
  return (
    <div className="w-full animate-pulse px-4 pt-6 sm:px-6" aria-hidden="true">
      <div className="h-3 w-24 rounded-full bg-surface" />
      <div className="mt-2 h-8 w-64 max-w-full rounded-xl bg-surface" />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-4 sm:p-5">
            <div className="h-8 w-16 rounded-lg bg-surface" />
            <div className="mt-2 h-3 w-24 rounded-full bg-surface" />
          </div>
        ))}
      </div>
      <div className="card mt-3 h-48" />
    </div>
  );
}
