import Image from 'next/image';
import { BrandIcon } from '@/components/BrandIcon';
import { ChannelPill } from '@/components/ui';
import type { ProviderKey } from '@/lib/types';

/**
 * Feature bento (Tenner architecture): 12-column grid, 2px ink-bordered
 * color tiles, product UI inside every tile. Copy is the existing accurate
 * feature text, trimmed to tile size.
 */

const tile = 'rounded-[28px] border border-line p-7 relative overflow-hidden';
const h3 = 'font-display text-xl font-semibold leading-tight tracking-tight';
const body = 'mt-2.5 text-[15px] leading-relaxed max-w-[36ch]';

const DOTS: ProviderKey[] = ['x', 'instagram', 'tiktok', 'threads', 'youtube', 'linkedin'];

export default function FeaturesBento() {
  return (
    <section aria-label="Features" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="max-w-[34ch]">
          <p className="eyebrow">What you get</p>
          <h2 className="mt-2 font-display text-3xl leading-[1.12] font-semibold tracking-tight md:text-4xl">
            Everything a daily poster needs.
          </h2>
          <p className="mt-3 text-muted">
            Four tools in one workspace. Compose, queue, write and approve without bolting
            anything on.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-12">
          <article className={`${tile} bg-white md:col-span-12`}>
            <div className="grid items-center gap-5 sm:grid-cols-2">
              <div>
                <h3 className={h3}>Write once, preview everywhere.</h3>
                <p className={`${body} text-muted`}>
                  One caption lays itself out across ten channels, each previewed the way it
                  will actually appear, with a live counter against its real limit.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5" aria-hidden="true">
                <ChannelPill provider="x" />
                <ChannelPill provider="instagram" />
                <ChannelPill provider="tiktok" />
                <ChannelPill provider="threads" />
                <ChannelPill provider="youtube" />
              </div>
            </div>
          </article>

          <article className={`${tile} bg-accent-soft md:col-span-8`}>
            <Image
              src="/bento-phone.png"
              alt=""
              width={200}
              height={413}
              loading="lazy"
              className="h-56 w-auto [filter:drop-shadow(0_16px_28px_rgba(28,26,20,0.3))]"
            />
            <h3 className={`${h3} mt-5`}>Ten networks, native previews.</h3>
            <p className={`${body} text-ink/75`}>
              Real API publishing with each network&apos;s real limits handled for you.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
              {DOTS.map((p) => (
                <BrandIcon key={p} provider={p} className="h-8 w-8" />
              ))}
            </div>
          </article>

          <div className="flex flex-col gap-4 md:col-span-4">
            <article className={`${tile} flex-1 bg-bolt`}>
              <h3 className={h3}>The queue runs itself.</h3>
              <p className={`${body} text-ink/80`}>
                Schedule and walk away. The worker ships every channel within a minute, app closed.
              </p>
              <div className="mt-4 space-y-2" aria-hidden="true">
                {[
                  ['Launch teaser', 'Queued'],
                  ['Roundup video', 'Sent'],
                ].map(([label, status]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl bg-paper px-3 py-2"
                  >
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="rounded-full bg-paper-dim px-2.5 py-0.5 text-[11px] font-bold">{status}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className={`${tile} flex-1 bg-ink text-paper`}>
              <h3 className={h3}>Teammates draft, you approve.</h3>
              <p className={`${body} text-paper/75`}>
                Members send posts for review. Approve in one tap, limit each person to the
                channels they run.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2" aria-hidden="true">
                <span className="rounded-full bg-bolt px-4 py-1.5 text-xs font-bold text-ink">Approve</span>
                <span className="rounded-full border-[1.5px] border-paper/40 px-4 py-1.5 text-xs font-bold">Send back</span>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
