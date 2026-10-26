import type { Metadata } from 'next';
import Link from 'next/link';
import { allResources } from '@/content/resources';
import { resourceHref, type ResourceKind } from '@/content/types';
import { HubHero, KIND_NOTES, ResourceCard, kindTone } from '@/components/site/ResourceKit';

export const metadata: Metadata = {
  title: 'Resource library',
  description:
    'Free templates, playbooks, cheat sheets and glossaries for social media managers: calendars, caption formulas, audits and launch plans.',
  alternates: { canonical: '/resources' },
};

/** Every kind the library holds, in display order; empty ones show as "soon". */
const KINDS: ResourceKind[] = ['Playbook', 'Guide', 'Glossary', 'Template', 'Cheat sheet'];

export default function ResourcesIndex() {
  const items = allResources();
  const count = (k: ResourceKind) => items.filter((r) => r.kind === k).length;
  const minutes = items.reduce((n, r) => n + r.minutes, 0);

  // Hero panel: one tinted row per kind, with what it is and how many.
  const kinds = (
    <ul className="grid gap-2" aria-label="In the library">
      {KINDS.map((k) => {
        const t = kindTone(k);
        const n = count(k);
        return (
          <li
            key={k}
            className={`flex items-center gap-3 rounded-[18px] px-4 py-3 ${n ? '' : 'opacity-60'}`}
            style={{ backgroundColor: t.bg, color: t.ink }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">{k}</p>
              <p className="truncate text-xs" style={{ color: t.sub }}>
                {KIND_NOTES[k]}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold">{n ? n : 'Soon'}</span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <HubHero
        active="library"
        title="Templates, playbooks and cheat sheets."
        lede="The working documents behind a calm content operation. Copy them, adapt them, use them this week."
        aside={kinds}
      >
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="text-[11px] font-extrabold tracking-[0.14em] text-faint uppercase">In the library</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold tracking-tight">{items.length}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-extrabold tracking-[0.14em] text-faint uppercase">Total reading</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold tracking-tight">{minutes} min</dd>
          </div>
          <div>
            <dt className="text-[11px] font-extrabold tracking-[0.14em] text-faint uppercase">Price</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold tracking-tight">Free</dd>
          </div>
        </dl>
      </HubHero>

      <div className="mx-auto max-w-[1200px] px-4 py-10 md:py-14">
        <div className="grid gap-5">
          {items.map((r) => (
            <ResourceCard key={r.slug} r={r} href={resourceHref(r.slug)} />
          ))}
        </div>

        {/* Where to go next once the library runs out. */}
        <div className="mt-10 flex flex-col gap-4 rounded-[28px] border border-dashed border-line px-6 py-7 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight">More templates are on the way.</p>
            <p className="mt-1 text-sm text-muted">Until then, the blog has step-by-step guides for every channel.</p>
          </div>
          <Link href="/blog" className="btn btn-ghost shrink-0 justify-center">
            Read the blog
          </Link>
        </div>
      </div>
    </>
  );
}
