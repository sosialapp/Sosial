import type { Metadata } from 'next';
import Link from 'next/link';
import { allResources, resource } from '@/content/resources';
import { resourceHref } from '@/content/types';

export const metadata: Metadata = {
  title: 'Resource library',
  description:
    'Free templates, playbooks, cheat sheets and glossaries for social media managers — calendars, caption formulas, audits and launch plans.',
  alternates: { canonical: '/resources' },
};

export default function ResourcesIndex() {
  const items = allResources();

  return (
    <>
      <section className="border-b border-line bg-card/60">
        <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
          <p className="eyebrow">Resource library</p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Templates, playbooks and cheat sheets.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            The working documents behind a calm content operation. Copy them, adapt them, use them
            this week.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((r) => (
            <Link
              key={r.slug}
              href={resourceHref(r.slug)}
              className="card flex h-full flex-col p-5 transition hover:border-accent"
            >
              <span className="pill w-fit bg-paper text-soft ring-1 ring-line">{r.kind}</span>
              <h2 className="mt-3 font-display text-lg font-extrabold leading-snug tracking-tight">
                {r.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{r.description}</p>
              <p className="mt-4 text-xs font-bold text-faint">{r.minutes} min read</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
