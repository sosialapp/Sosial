import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from './locales';

/**
 * Locale URLs for search. The UI language normally follows the
 * `sosial_locale` cookie, which crawlers never send, so on its own every page
 * is English to Google. Pages whose whole body is translated also answer at a
 * locale-prefixed URL (/es, /es/pricing…): the middleware rewrites those onto
 * the normal route and passes the locale in a request header. Unprefixed URLs
 * stay exactly as they were (English for crawlers, the cookie for people).
 *
 * Shared by the middleware (edge), server components and the client.
 */

/** Public pages translated end to end, each with one URL per locale. Their
 *  copy lives in lib/i18n/landing + pricing and content/pages/*. */
export const LOCALIZED_PATHS: readonly string[] = [
  '/',
  '/pricing',
  '/features',
  '/features/create',
  '/publish',
  '/ai-assistant',
  '/integrations',
  '/compare',
  '/made-for-everyone',
  '/transparency',
];

/** Request header the middleware sets on a locale-prefixed request. */
export const LOCALE_HEADER = 'x-sosial-locale';

/** hreflang codes; zh is Simplified Chinese. */
const HREFLANG: Record<Locale, string> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  ja: 'ja',
  ko: 'ko',
  zh: 'zh-Hans',
};

/** Open Graph og:locale values. */
export const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_ES',
  fr: 'fr_FR',
  de: 'de_DE',
  ja: 'ja_JP',
  ko: 'ko_KR',
  zh: 'zh_CN',
};

export function isLocalizedPath(path: string): boolean {
  return LOCALIZED_PATHS.includes(path);
}

/** `/es/pricing` → { locale: 'es', path: '/pricing' }; unprefixed → locale null. */
export function splitLocalePath(pathname: string): { locale: Locale | null; path: string } {
  const m = /^\/([a-z]{2})(\/.*)?$/.exec(pathname);
  if (!m || !isLocale(m[1])) return { locale: null, path: pathname };
  return { locale: m[1], path: m[2] && m[2] !== '/' ? m[2] : '/' };
}

/** The URL of `path` in `locale`: unprefixed for English, `/es`, `/es/pricing`… */
export function localizedPath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE || !isLocalizedPath(path)) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/** hreflang map for a localized page (x-default is the English URL). */
export function hreflangAlternates(path: string, base = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of LOCALES) out[HREFLANG[l]] = `${base}${localizedPath(path, l)}`;
  out['x-default'] = `${base}${path}`;
  return out;
}
