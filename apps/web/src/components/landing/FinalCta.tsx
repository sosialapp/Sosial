import Link from 'next/link';

/**
 * Closing CTA band (Tenner architecture): powder rounded box with ink
 * border, headline left, actions right, small cloud deco.
 */
export default function FinalCta() {
  return (
    <section aria-label="Get started" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 pb-20 md:pb-28">
        <div className="relative grid grid-cols-1 items-center gap-8 overflow-hidden rounded-[36px] border-2 border-ink bg-[#D7E8F2] p-9 md:p-14 lg:grid-cols-[1.2fr_0.8fr]">
          <span aria-hidden="true" className="absolute top-6 right-[30%] h-10 w-36 rounded-full bg-white/70">
            <span className="absolute top-[-18px] left-6 h-12 w-12 rounded-full bg-white/70" />
            <span className="absolute top-[-26px] left-16 h-16 w-16 rounded-full bg-white/70" />
          </span>
          <div className="relative z-[2]">
            <h2 className="max-w-[12ch] font-display text-4xl leading-[1.02] font-semibold tracking-tight md:text-5xl">
              Calm publishing starts free.
            </h2>
            <p className="mt-4 max-w-[44ch] text-ink/80">
              Ten channels, one calendar, priced in the open. The queue takes it from here.
            </p>
          </div>
          <div className="relative z-[2] flex flex-col items-start gap-3 justify-self-start lg:justify-self-end">
            <Link
              href="/login"
              className="inline-flex items-center gap-2.5 rounded-full border-2 border-ink bg-ink px-6 py-3.5 font-display text-base font-semibold text-paper transition-all hover:-translate-y-0.5"
            >
              Start scheduling free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2.5 rounded-full border-2 border-ink bg-white px-6 py-3.5 font-display text-base font-semibold text-ink transition-all hover:-translate-y-0.5"
            >
              See pricing
            </Link>
            <small className="text-[13px] text-ink/75">Free plan · No credit card · Cancel anytime.</small>
          </div>
        </div>
      </div>
    </section>
  );
}
