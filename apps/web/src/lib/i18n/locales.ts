/** Supported locales. `ar` renders right-to-left; everything else LTR. */
export const LOCALES = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie that carries the choice from the switcher to server components. */
export const LOCALE_COOKIE = 'sosial_locale';

/** One year, path-wide, cookie attributes for document.cookie in the browser. */
export const LOCALE_COOKIE_ATTRS = 'path=/; max-age=31536000; samesite=lax';

/** Native display names — the switcher lists languages in their own script. */
export const LOCALE_META: Record<Locale, { name: string; dir: 'ltr' | 'rtl' }> = {
  en: { name: 'English', dir: 'ltr' },
  es: { name: 'Español', dir: 'ltr' },
  fr: { name: 'Français', dir: 'ltr' },
  de: { name: 'Deutsch', dir: 'ltr' },
  ja: { name: '日本語', dir: 'ltr' },
  ko: { name: '한국어', dir: 'ltr' },
  zh: { name: '简体中文', dir: 'ltr' },
  ar: { name: 'العربية', dir: 'rtl' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Safe read for persisted values: invalid or absent falls back to English. */
export function normalizeLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function dirOf(locale: Locale): 'ltr' | 'rtl' {
  return LOCALE_META[locale].dir;
}

/**
 * Translate a flat key for `locale`, falling back to English for anything a
 * local dictionary hasn't translated yet, and to the key itself last (which
 * only ever renders on a missing-key bug, and stays debuggable in the markup).
 */
export function translator(
  dictionary: Record<Locale, Record<string, string>>,
  locale: Locale,
): (key: string) => string {
  const primary = dictionary[locale] ?? {};
  const fallback = dictionary[DEFAULT_LOCALE] ?? {};
  return (key: string) => primary[key] ?? fallback[key] ?? key;
}
