import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandIcon } from '@/components/BrandIcon';
import { CHANNEL_GUIDES, channelGuide, relatedChannels } from '@/content/channels';
import { channelHref } from '@/content/types';

export function generateStaticParams() {
  return CHANNEL_GUIDES.map((c) => ({ slug: c.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = channelGuide(slug);
  if (!c) return { title: 'Integration not found' };
  return {
    title: `Sosial × ${c.name}`,
    description: c.tagline,
    alternates: { canonical: channelHref(c.key) },
    openGraph: { title: `Sosial × ${c.name}`, description: c.tagline },
  };
}

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = channelGuide(slug);
  if (!c) notFound();

  const related = relatedChannels(slug);

  return (
    <>
      <section className="border-b border-line bg-card/60">
        <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
          <Link href="/integrations" className="text-xs font-bold text-muted hover:text-ink">
            ← All integrations
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-paper ring-1 ring-line">
              <BrandIcon provider={c.key} className="h-6 w-6" />
            </span>
            <div>
              <p className="eyebrow">Integration</p>
              <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
                Sosial × {c.name}
              </h1>
            </div>
          </div>
          <p className="mt-5 text-lg leading-relaxed text-muted">{c.tagline}</p>
          <Link href="/login" className="btn btn-primary mt-6">
            Connect {c.name}
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-base leading-relaxed text-soft">{c.intro}</p>

        <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {c.facts.map((f) => (
            <div key={f.label} className="card p-4">
              <dt className="eyebrow">{f.label}</dt>
              <dd className="mt-1.5 text-sm font-semibold leading-relaxed text-soft">{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8">
          <p className="eyebrow">Best for</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.bestFor.map((b) => (
              <span key={b} className="pill bg-paper px-3 py-1.5 text-xs text-soft ring-1 ring-line">
                {b}
              </span>
            ))}
          </div>
        </div>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">
            How to win on {c.name}
          </h2>
          <ol className="mt-5 space-y-4">
            {c.tips.map((t, i) => (
              <li key={t.title} className="card p-5">
                <p className="font-display text-sm font-extrabold text-accent">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-1 font-display text-lg font-extrabold tracking-tight">{t.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Common mistakes</h2>
          <ul className="mt-5 space-y-3">
            {c.pitfalls.map((p) => (
              <li key={p} className="flex gap-3 text-sm leading-relaxed text-muted">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">
            {c.name} on Sosial — FAQ
          </h2>
          <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {c.faqs.map((f) => (
              <details key={f.q} className="group bg-card open:bg-paper">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-display text-sm font-bold">
                  {f.q}
                  <span aria-hidden="true" className="text-faint transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              Also publishes to
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.key}
                  href={channelHref(r.key)}
                  className="card flex items-center gap-3 p-4 transition hover:border-accent"
                >
                  <BrandIcon provider={r.key} className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-bold">{r.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="reveal mt-12 rounded-3xl bg-accent px-6 py-10 text-center">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">
            Schedule your next {c.name} post.
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/85">
            Draft with the AI writer, then let the queue publish on time.
          </p>
          <Link href="/login" className="btn mt-6 bg-white font-bold text-accent hover:bg-bone">
            Start scheduling free
          </Link>
        </div>
      </div>
    </>
  );
}
