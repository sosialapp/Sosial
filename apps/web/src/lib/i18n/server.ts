import 'server-only';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, normalizeLocale, type Locale } from './locales';

/** Server-side locale read: the `sosial_locale` cookie, else English. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}
