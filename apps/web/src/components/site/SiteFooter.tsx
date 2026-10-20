import Link from 'next/link';
import { BRAND_NAMES, BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { siteFooterPages } from '@/lib/sitePages';
import { translator } from '@/lib/i18n/locales';
import { landingMessages } from '@/lib/i18n/landing';
import { getLocale } from '@/lib/i18n/server';
import Logo from './Logo';

/** Footer for every public page. Only links to routes that exist. */
const SOCIALS: BrandProvider[] = [
  'facebook',
  'instagram',
  'threads',
  'tiktok',
  'x',
  'bluesky',
  'mastodon',
  'linkedin',
];

/** Near-black marks read as invisible on the dark footer, those brands ship white on dark. */
const DARK_MARKS: BrandProvider[] = ['tiktok', 'x', 'threads'];

export default async function SiteFooter() {
  const locale = await getLocale();
  const t = translator(landingMessages, locale);
  // Custom CMS pages flagged "show in footer" (live only, drafts never leak).
  const extraPages = await siteFooterPages();
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-10 px-4 py-16 md:grid-cols-3 md:py-20 lg:grid-cols-[1.4fr_1fr_1.1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-paper/60">
            {t('footTag')}
          </p>
          <Link href="/login" className="btn btn-bolt mt-5">
            {t('footCta')}
          </Link>
          <div className="mt-5 flex flex-wrap items-center gap-3" aria-label="Sosial on social media">
            {SOCIALS.map((p) => (
              <Link
                key={p}
                href={`/integrations/${p}`}
                aria-label={`Sosial on ${BRAND_NAMES[p]}`}
                title={`Sosial on ${BRAND_NAMES[p]}`}
                className="text-white transition hover:opacity-75"
              >
                {DARK_MARKS.includes(p) ? (
                  <BrandIcon provider={p} mono className="h-6 w-6" />
                ) : (
                  <BrandIcon provider={p} badge={false} className="h-6 w-6" />
                )}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-paper/60">
            Operated by EGATE WORLDWIDE (KT0582667-V)
            <br />
            <a href="mailto:support@sosial.app" className="underline hover:text-paper">
              support@sosial.app
            </a>
          </p>
        </div>

        <nav aria-label={t('footProduct')}>
          <p className="eyebrow text-paper/50">{t('footProduct')}</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-paper/80">
            <li>
              <Link href="/publish" className="hover:text-paper">
                {t('footPublish')}
              </Link>
            </li>
            <li>
              <Link href="/features/create" className="hover:text-paper">
                {t('footCreate')}
              </Link>
            </li>
            <li>
              <Link href="/ai-assistant" className="hover:text-paper">
                {t('footAi')}
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-paper">
                {t('footPricing')}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t('footResources')}>
          <p className="eyebrow text-paper/50">{t('footResources')}</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-paper/80">
            <li>
              <Link href="/integrations" className="hover:text-paper">
                {t('footChannels')}
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-paper">
                {t('footBlog')}
              </Link>
            </li>
            <li>
              <Link href="/resources" className="hover:text-paper">
                {t('footLib')}
              </Link>
            </li>
            <li>
              <Link href="/compare" className="hover:text-paper">
                {t('footCompare')}
              </Link>
            </li>
            <li>
              <Link href="/made-for-everyone" className="hover:text-paper">
                {t('footMade')}
              </Link>
            </li>
            <li>
              <Link href="/transparency" className="hover:text-paper">
                {t('footTransparency')}
              </Link>
            </li>
            <li>
              <Link href="/developers" className="hover:text-paper">
                {t('footDevelopers')}
              </Link>
            </li>
            <li>
              <a href="https://status.sosial.app/status/sosial" className="hover:text-paper">
                {t('footStatus')}
              </a>
            </li>
            {extraPages.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className="hover:text-paper">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t('footCompany')}>
          <p className="eyebrow text-paper/50">{t('footCompany')}</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-paper/80">
            <li>
              <Link href="/about" className="hover:text-paper">
                {t('footAbout')}
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-paper">
                {t('footStart')}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-paper">
                {t('footTerms')}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-paper">
                {t('footPrivacy')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-5 text-xs text-paper/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} EGATE WORLDWIDE (KT0582667-V) · Sosial. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
