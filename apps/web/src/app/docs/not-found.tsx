import Link from 'next/link';

export default function DocsNotFound() {
  return (
    <div className="w-full px-4 py-24 text-center sm:px-8">
      <p className="text-xs uppercase tracking-[0.08em] text-ink/55">404</p>
      <h1 className="mt-2 font-display text-3xl font-medium">Page not found</h1>
      <p className="mt-3 text-ink/70">This docs page doesn&apos;t exist or isn&apos;t published.</p>
      <Link href="/" className="btn btn-primary mt-6 inline-flex">
        Back to the docs
      </Link>
    </div>
  );
}
