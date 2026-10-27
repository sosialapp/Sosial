import { translator } from '@/lib/i18n/locales';
import { landingMessages } from '@/lib/i18n/landing';
import { getLocale } from '@/lib/i18n/server';

/**
 * FAQ as native disclosure rows (works without JS, keyboard and screen
 * readers get it for free).
 */
export default async function Faq() {
  const t = translator(landingMessages, await getLocale());
  const QA = [1, 2, 3, 4, 5].map((n) => ({ q: t(`lpQ${n}`), a: t(`lpA${n}`) }));
  return (
    <section id="faq" aria-label={t('lpFaqH2')} className="scroll-mt-16 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-20 md:py-28">
        <h2 className="font-display text-3xl font-[400] tracking-[-0.03em] sm:text-4xl">{t('lpFaqH2')}</h2>
        <div className="mt-10 flex flex-col gap-2">
          {QA.map((x) => (
            <details key={x.q} className="group rounded-2xl bg-[#F5F5F3] transition-colors hover:bg-[#EFEFEC]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-5 font-display text-[16px] font-[400] [&::-webkit-details-marker]:hidden">
                {x.q}
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-ink/50 transition-transform group-open:rotate-180"
                  fill="none"
                >
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <p className="px-6 pb-6 text-[15px] leading-relaxed text-ink/60">{x.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
