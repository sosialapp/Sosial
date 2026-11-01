import 'server-only';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, isLocale, normalizeLocale, type Locale } from './locales';
import { LOCALE_HEADER } from './routing';

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
