/**
 * Team section (Tenner parents architecture): ink band, control rows with
 * copy left, SVG iPhone render (real app screenshot on screen) right. Copy
 * is the existing accurate approvals text.
 */
'use client';

import Image from 'next/image';
import { useT } from '@/lib/i18n/client';
import { landingMessages } from '@/lib/i18n/landing';

export default function TeamSection() {
  const t = useT(landingMessages);
  const CONTROLS = [
    { title: t('t1t'), body: t('t1d') },
    { title: t('t2t'), body: t('t2d') },
    { title: t('t3t'), body: t('t3d') },
    { title: t('t4t'), body: t('t4d') },
  ];
  return (
    <section aria-label={t('teamEyebrow')} className="bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-14 md:py-28 lg:grid-cols-2">
        <div>
          <p className="eyebrow !text-paper/60">{t('teamEyebrow')}</p>
          <h2 className="mt-2 font-display text-3xl leading-[1.12] font-semibold tracking-tight md:text-4xl">
            {t('teamH2')}
          </h2>
          <p className="mt-3 max-w-[52ch] text-paper/75">
            {t('teamSub')}
          </p>
          <div className="mt-8 grid gap-3">
            {CONTROLS.map((c) => (
              <div key={c.title} className="rounded-[18px] border-[1.5px] border-paper/15 bg-paper/[0.06] p-4">
                <h3 className="font-display text-[17px] font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-paper/70">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="justify-self-center" aria-label="Sosial app on iPhone">
          <Image
            src="/team-phone.png"
            alt=""
            width={400}
            height={826}
            loading="lazy"
            unoptimized
            className="h-auto w-72 [filter:drop-shadow(0_30px_60px_rgba(0,0,0,0.5))] sm:w-96"
          />
        </div>
      </div>
    </section>
  );
}
