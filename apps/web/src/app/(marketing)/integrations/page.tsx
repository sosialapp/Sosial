import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandIcon } from '@/components/BrandIcon';
import { CHANNEL_GUIDES } from '@/content/channels';
import { channelHref } from '@/content/types';

export const metadata: Metadata = {
  title: 'Integrations',
  description:
    'Publish to X, Instagram, TikTok, Facebook, Threads, Bluesky, Mastodon, LinkedIn, YouTube and Pinterest from one Sosial calendar.',
  alternates: { canonical: '/integrations' },
};

export default function IntegrationsIndex() {
  return (
    <>
      <section className="border-b border-line bg-card/60">
        <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
          <p className="eyebrow">Integrations</p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Sosial × every channel you use.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            Real API publishing, per-channel limits handled for you, and honest notes on what each
            network actually rewards.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CHANNEL_GUIDES.map((c) => (
            <Link
              key={c.key}
              href={channelHref(c.key)}
              className="card flex h-full flex-col p-5 transition hover:border-accent"
            >
              <span className="flex items-center gap-3">
                <BrandIcon provider={c.key} className="h-10 w-10 shrink-0" />
                <span className="font-display text-xl font-extrabold tracking-tight">
                  Sosial × {c.name}
                </span>
              </span>
              <span className="mt-3 flex-1 text-sm leading-relaxed text-muted">{c.tagline}</span>
              <span className="mt-4 flex flex-wrap gap-1.5">
                {c.bestFor.slice(0, 3).map((b) => (
                  <span key={b} className="pill bg-paper text-soft ring-1 ring-line">
                    {b}
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
