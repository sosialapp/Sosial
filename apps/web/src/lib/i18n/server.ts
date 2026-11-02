import 'server-only';
import { cookies, headers } from 'next/headers';
import { landingMessages } from './landing';
import { LOCALE_COOKIE, isLocale, normalizeLocale, translator, type Locale } from './locales';
import { LOCALE_HEADER, localizedPath } from './routing';

/**
 * Server-side locale read: a locale-prefixed URL first (the middleware puts
 * /es/… into a request header), then the `sosial_locale` cookie, else English.
 */
export async function getLocale(): Promise<Locale> {
  const fromUrl = (await headers()).get(LOCALE_HEADER);
  if (isLocale(fromUrl)) return fromUrl;
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}

/**
 * Site chrome for server components: the locale, the landing dictionary's
 * translator (nav, buttons, shared marketing blocks) and a link helper that
 * points translated pages at this locale's URL.
 */
export async function siteI18n(): Promise<{
  locale: Locale;
  t: (key: string) => string;
  href: (path: string) => string;
}> {
  const locale = await getLocale();
  return {
    locale,
    t: translator(landingMessages, locale),
    href: (path: string) => localizedPath(path, locale),
  };
}
