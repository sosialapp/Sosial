import { BrandIcon, BRAND_NAMES, type BrandProvider } from '@/components/BrandIcon';
import { CAPABILITIES } from '@/lib/compat';
import { translator } from '@/lib/i18n/locales';
import { landingMessages } from '@/lib/i18n/landing';
import { getLocale } from '@/lib/i18n/server';

/**
 * Channel capability matrix: one row per channel, publish formats on the
 * left, engagement on the right. Formats read straight from CAPABILITIES so
 * the table can't drift from the composer; the engage sets mirror
 * CommentsFeed's REPLY_PROVIDERS, MessagesInbox's DM_PROVIDERS and the
 * worker's statsFor() switch. Scrolls sideways on narrow screens with the
 * channel column pinned.
 */

/** Same order as LogoDock; the last two aren't connectable yet. */
const ROWS: BrandProvider[] = [
  'instagram',
  'tiktok',
  'x',
  'facebook',
  'threads',
  'youtube',
  'pinterest',
  'bluesky',
  'mastodon',
  'telegram',
  'discord',
  'wordpress',
  'devto',
  'hashnode',
  'ghost',
  'vk',
  'linkedin',
  'gmb',
];
const SOON = new Set<BrandProvider>(['linkedin', 'gmb']);

const REPLY = new Set(['facebook', 'instagram', 'threads', 'x', 'mastodon', 'bluesky', 'youtube']);
const DM = new Set(['facebook', 'instagram', 'x', 'mastodon', 'bluesky']);
const STATS = new Set(['facebook', 'instagram', 'threads', 'x', 'bluesky', 'mastodon', 'pinterest', 'youtube', 'linkedin', 'tiktok']);

type Col = { key: string; has: (p: string) => boolean };

const PUBLISH: Col[] = [
  { key: 'lpCtText', has: (p) => CAPABILITIES[p].supports.text && !CAPABILITIES[p].requiresMedia },
  { key: 'lpCtMedia', has: (p) => CAPABILITIES[p].supports.image || CAPABILITIES[p].supports.video },
  // Carousels plus channels that take several attachments in one post (X, Bluesky, Discord...).
  {
    key: 'lpCtMulti',
    has: (p) => CAPABILITIES[p].supports.carousel || (CAPABILITIES[p].limits.media ?? 1) > 1,
  },
  { key: 'lpCtThread', has: (p) => CAPABILITIES[p].thread },
  { key: 'lpCtArticle', has: (p) => CAPABILITIES[p].article },
];

const ENGAGE: Col[] = [
  { key: 'lpCtReply', has: (p) => REPLY.has(p) },
  { key: 'lpCtDm', has: (p) => DM.has(p) },
  { key: 'lpCtStats', has: (p) => STATS.has(p) },
];

/** Footnotes pinned to a specific cell, numbered in reading order. */
const NOTES: Record<string, number> = {
  'youtube:lpCtMedia': 1,
  'devto:lpCtMedia': 2,
  'ghost:lpCtMedia': 2,
  'vk:lpCtMedia': 2,
  'pinterest:lpCtMedia': 3,
  'tiktok:lpCtStats': 4,
};

function Mark({ on, note }: { on: boolean; note?: number }) {
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center">
      {on ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-ink" fill="none">
          <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="h-1 w-1 rounded-full bg-ink/20" />
      )}
      {note ? (
        <sup className="absolute -right-2.5 -top-2.5 text-[9px] font-semibold text-ink/50">{note}</sup>
      ) : null}
    </span>
  );
}

/**
 * The matrix and its footnotes, without the section heading. The landing page
 * wraps it in ChannelTable; the docs home renders it on its black theme
 * (`docs`), where the pinned channel column must follow the theme tokens
 * instead of white, and each channel name links to its docs page.
 */
export async function ChannelMatrix({
  docs = false,
  hrefFor,
}: {
  docs?: boolean;
  /** Link for a channel's name, or null for plain text. */
  hrefFor?: (p: BrandProvider) => string | null;
}) {
  const t = translator(landingMessages, await getLocale());
  const cols = [...PUBLISH, ...ENGAGE];
  // Docs: the table sits on a surface band, so the pinned column matches it.
  const pin = docs ? 'bg-surface' : 'bg-white';
  const rowHover = docs ? 'hover:bg-card' : 'hover:bg-[#FAFAF8]';
  const pinHover = docs ? '[tr:hover_&]:bg-card' : '[tr:hover_&]:bg-[#FAFAF8]';
  return (
    <>
      <div className="-mx-4 mt-12 overflow-x-auto px-4 [scrollbar-width:thin]">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/40">
              <th className={`sticky left-0 z-10 ${pin}`} />
              <th colSpan={PUBLISH.length} className="pb-2 text-center font-semibold">
                {t('lpCtPublish')}
              </th>
              <th colSpan={ENGAGE.length} className="border-l border-line pb-2 text-center font-semibold">
                {t('lpCtEngage')}
              </th>
            </tr>
            <tr className="border-b border-line text-[13px] text-ink/60">
              <th scope="col" className={`sticky left-0 z-10 ${pin} py-4 pr-6 font-medium`}>
                <span className="sr-only">{t('dockChannels')}</span>
              </th>
              {cols.map((c, i) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-4 text-center font-medium ${
                    i === PUBLISH.length ? 'border-l border-line' : ''
                  }`}
                >
                  {t(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((p) => {
              const soon = SOON.has(p);
              const href = hrefFor?.(p) ?? null;
              const name = <span className="whitespace-nowrap font-display text-[15px] font-semibold">{BRAND_NAMES[p]}</span>;
              return (
                <tr key={p} className={`border-b border-line-soft transition-colors ${rowHover}`}>
                  <th scope="row" className={`sticky left-0 z-10 ${pin} py-4 pr-6 text-left font-normal ${pinHover}`}>
                    <span className="flex items-center gap-3">
                      <BrandIcon provider={p} className={`h-6 w-6 ${docs ? 'rounded-full dark:ring-1 dark:ring-white/25' : ''}`} />
                      {href ? (
                        <a href={href} className="hover:underline underline-offset-4">
                          {name}
                        </a>
                      ) : (
                        name
                      )}
                      <span className="hidden text-[13px] text-ink/45 sm:inline">{t(`lpCtAs_${p}`)}</span>
                      {soon ? (
                        <span className="rounded-full border border-line px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-ink/45">
                          {t('dockSoon')}
                        </span>
                      ) : null}
                    </span>
                  </th>
                  {cols.map((c, i) => {
                    const on = c.has(p);
                    return (
                      <td
                        key={c.key}
                        className={`px-3 py-4 text-center ${i === PUBLISH.length ? 'border-l border-line' : ''} ${
                          soon ? 'opacity-35' : ''
                        }`}
                      >
                        <Mark on={on} note={NOTES[`${p}:${c.key}`]} />
                        <span className="sr-only">{on ? t('lpCtYes') : t('lpCtNo')}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ol className="mt-8 grid gap-1.5 text-[13px] leading-relaxed text-ink/50 sm:grid-cols-2">
        {[1, 2, 3, 4].map((n) => (
          <li key={n}>
            <span className="mr-1.5 font-semibold text-ink/70">{n}</span>
            {t(`lpCtN${n}`)}
          </li>
        ))}
      </ol>
    </>
  );
}

export default async function ChannelTable() {
  const t = translator(landingMessages, await getLocale());
  return (
    <section id="channels" aria-label={t('lpCtH2')} className="scroll-mt-16 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <h2 className="max-w-3xl font-display text-3xl font-[700] leading-[1.1] tracking-[-0.03em] text-balance sm:text-5xl">
          {t('lpCtH2')}
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink/55 sm:text-base">{t('lpCtSub')}</p>
        <ChannelMatrix />
      </div>
    </section>
  );
}
