import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Scale } from 'lucide-react';
import { seo } from '@/lib/seo';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import { FaqList } from '@/components/site/PageBlocks';
import { CheckList, Hero, Section } from '@/components/site/Marketing';
import Reveal from '@/components/anim/Reveal';
import { COMPETITORS, competitor, competitorHref } from '@/content/competitors';
import { formatPostDate } from '@/content/types';

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = competitor(slug);
  if (!c) return { title: 'Comparison not found' };
  // "<tool> alternative" and "Sosial vs <tool>" are what people search and ask.
  return seo({
    path: competitorHref(c.slug),
    title: `${c.name} alternative: Sosial vs ${c.name}`,
    description: c.verdict,
    kicker: 'Compare',
    cardTitle: `Sosial vs ${c.name}`,
  });
}

/**
 * One head-to-head comparison (English only, like the integration pages):
 * the verdict up top, a quotable summary, a fact table, who should pick
 * which, then FAQs (with FAQPage JSON-LD via FaqList).
 */
export default async function CompetitorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = competitor(slug);
  if (!c) notFound();
  const others = COMPETITORS.filter((o) => o.slug !== c.slug);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', path: '/' },
          { name: 'Compare', path: '/compare' },
          { name: `Sosial vs ${c.name}`, path: competitorHref(c.slug) },
        ]}
      />
      <Hero
        icon={Scale}
        kicker="Compare"
        title={`Sosial vs ${c.name}`}
        lede={c.verdict}
        meta={`Facts checked ${formatPostDate(c.reviewed)}`}
        secondary={{ href: '/pricing', label: 'See pricing' }}
      />

      <Section flush>
        <Reveal y={24}>
          <h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
            How is Sosial different from {c.name}?
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-ink/70 sm:text-[17px]">{c.summary}</p>

          <div className="relative mt-10 overflow-x-auto rounded-[24px] border border-line">
            <table className="w-full min-w-[640px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="w-[24%] px-6 py-5 text-left text-sm font-medium text-ink/55">
                    &nbsp;
                  </th>
                  <th scope="col" className="w-[38%] bg-surface px-5 py-5 text-left font-display font-[700]">
                    <span className="inline-flex items-center gap-2">
                      <Image src="/bolt.png" alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                      Sosial
                    </span>
                  </th>
                  <th scope="col" className="px-5 py-5 text-left font-display font-[700] text-ink/70">
                    {c.name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map(([label, ours, theirs]) => (
                  <tr key={label} className="border-b border-line align-top last:border-b-0">
                    <th scope="row" className="px-6 py-4 text-left text-sm font-bold text-ink/80">
                      {label}
                    </th>
                    <td className="bg-surface px-5 py-4 leading-relaxed text-ink/80">{ours}</td>
                    <td className="px-5 py-4 leading-relaxed text-ink/65">{theirs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-ink/50">
            {c.name} changes its plans from time to time, and so do we. Check {c.name}&rsquo;s own pricing page before
            you decide. Something here out of date? Tell us at support@sosial.app and we will fix it.
          </p>
        </Reveal>
      </Section>

      <Section tone="surface">
        <div className="grid gap-12 md:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">Choose {c.name} if</h2>
            <div className="mt-6">
              <CheckList items={c.pickThem} />
            </div>
          </Reveal>
          <Reveal>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">Choose Sosial if</h2>
            <div className="mt-6">
              <CheckList items={c.pickSosial} />
            </div>
          </Reveal>
        </div>
      </Section>

      <FaqList items={c.faqs} title={`Sosial vs ${c.name}: FAQ`} />

      <Section>
        <h2 className="font-display text-xl font-extrabold tracking-tight">More comparisons</h2>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {[...others.map((o) => ({ href: competitorHref(o.slug), label: `Sosial vs ${o.name}` })), { href: '/compare', label: 'Suites, single-network apps and posting by hand' }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-bold text-ink/75 transition hover:bg-surface hover:text-ink"
            >
              {l.label}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
