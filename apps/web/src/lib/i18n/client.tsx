'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { dirOf, translator, type Locale } from './locales';

/**
 * Client bridge: the server layout reads the cookie once and hands the
 * locale down; any client component under the provider translates with
 * `useT(dict)`. Server components instead translate with `getLocale()` +
 * the same dictionaries directly (no context for RSC).
 */

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Hook for client components: `const t = useT(landingMessages); t('heroCta')`. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(dictionary: Record<Locale, Record<string, string>>) {
  const locale = useLocale();
  return useMemo(() => translator(dictionary, locale), [dictionary, locale]);
}
