import Image from 'next/image';

/**
 * Feature bento (Tenner architecture): 12-column grid, 2px ink-bordered
 * color tiles. Copy is the existing accurate feature text, trimmed to tile
 * size. The only graphic is the 10-channels artwork.
 */

const tile = 'rounded-[28px] border border-line p-7 relative overflow-hidden';
const h3 = 'font-display text-xl font-semibold leading-tight tracking-tight';
const body = 'mt-2.5 text-[15px] leading-relaxed max-w-[36ch]';

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
            <h3 className={h3}>Write once, preview everywhere.</h3>
            <p className={`${body} text-muted`}>
              One caption lays itself out across ten channels, each previewed the way it
              will actually appear, with a live counter against its real limit.
            </p>
          </article>

          <article className={`${tile} bg-accent-soft md:col-span-8`}>
            <Image
              src="/bento-channels.svg"
              alt="Ten channels"
              width={175}
              height={175}
              loading="lazy"
              className="h-44 w-auto rounded-2xl [filter:drop-shadow(0_16px_28px_rgba(28,26,20,0.3))]"
            />
            <h3 className={`${h3} mt-5`}>Ten networks, native previews.</h3>
            <p className={`${body} text-ink/75`}>
              Real API publishing with each network&apos;s real limits handled for you.
            </p>
          </article>

          <div className="flex flex-col gap-4 md:col-span-4">
            <article className={`${tile} flex-1 bg-bolt`}>
              <h3 className={h3}>The queue runs itself.</h3>
              <p className={`${body} text-ink/80`}>
                Schedule and walk away. The worker ships every channel within a minute, app closed.
              </p>
            </article>

            <article className={`${tile} flex-1 bg-ink text-paper`}>
              <h3 className={h3}>Teammates draft, you approve.</h3>
              <p className={`${body} text-paper/75`}>
                Members send posts for review. Approve in one tap, limit each person to the
                channels they run.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
