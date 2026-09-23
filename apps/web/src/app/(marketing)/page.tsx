import Hero from '@/components/landing/Hero';
import { ChannelPill } from '@/components/ui';

/** Landing: navbar (layout) + hero + features bento + footer (layout). */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <FeaturesBento />
    </>
  );
}

function FeaturesBento() {
  return (
    <section aria-label="Features" className="border-t border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:py-24">
        <p className="eyebrow">Features</p>
        <h2 className="mt-2 max-w-xl font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Everything you need to ship daily.
        </h2>
        <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-6">
          <article className="card p-6 md:col-span-4">
            <p className="eyebrow">Composer</p>
            <h3 className="mt-2 font-display text-xl font-extrabold tracking-tight">
              Write once, preview everywhere.
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              One caption lays itself out across ten channels, each previewed the way it will
              actually appear, with a live counter against its real limit.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5" aria-hidden="true">
              <ChannelPill provider="x" />
              <ChannelPill provider="instagram" />
              <ChannelPill provider="tiktok" />
              <ChannelPill provider="threads" />
              <ChannelPill provider="youtube" />
            </div>
          </article>

          <article className="card p-6 md:col-span-2">
            <p className="eyebrow">Queue</p>
            <h3 className="mt-2 font-display text-xl font-extrabold tracking-tight">
              The queue runs itself.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Schedule and walk away. The worker ships every channel within a minute.
            </p>
            <div className="mt-5 space-y-1.5" aria-hidden="true">
              {[
                ['Launch teaser', 'Queued'],
                ['Roundup video', 'Sent'],
              ].map(([label, status]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-[10px] border border-line bg-paper px-2.5 py-2"
                >
                  <span className="text-xs font-semibold text-soft">{label}</span>
                  <span className="pill bg-paper-dim text-ink">{status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card p-6 md:col-span-2">
            <p className="eyebrow">AI writer</p>
            <h3 className="mt-2 font-display text-xl font-extrabold tracking-tight">
              Captions in your voice.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Topic in, captioned thread out, sized to your strictest channel.
            </p>
            <p className="mt-5 rounded-[10px] border border-line bg-paper p-3 text-xs leading-relaxed text-soft" aria-hidden="true">
              The hook your scrollers stop for, with hashtags that earn their place.
            </p>
          </article>

          <article className="card p-6 md:col-span-4">
            <p className="eyebrow">Approvals</p>
            <h3 className="mt-2 font-display text-xl font-extrabold tracking-tight">
              Teammates draft, you approve.
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              Members send posts for review instead of publishing. Approve in one tap or send a
              note back, and limit each person to the channels they actually run.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2" aria-hidden="true">
              <span className="btn btn-bolt !px-4 !py-1.5 !text-xs">Approve</span>
              <span className="btn btn-ghost !px-4 !py-1.5 !text-xs">Send back</span>
              <span className="pill bg-paper-dim text-ink">Waiting on you</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
