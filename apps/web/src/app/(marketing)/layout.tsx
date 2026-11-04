import type { ReactNode } from 'react';
import ScrollProgress from '@/components/anim/ScrollProgress';
import SiteFooter from '@/components/site/SiteFooter';
import SiteNav from '@/components/site/SiteNav';
import UmamiScript from '@/components/site/UmamiScript';
import { SiteJsonLd } from '@/components/site/JsonLd';
import { MessagesProvider } from '@/lib/i18n/client';
import { landingMessages } from '@/lib/i18n/landing';
import { messagesFor } from '@/lib/i18n/locales';
import { getLocale } from '@/lib/i18n/server';

/** Chrome for every public page: progress bar, sticky nav, footer. The
 *  landing strings go down for the visitor's locale only (useMessages). */
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <MessagesProvider messages={messagesFor(landingMessages, locale)}>
      <div className="flex min-h-screen flex-col">
        <SiteJsonLd />
        <ScrollProgress />
        <SiteNav />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <UmamiScript />
      </div>
    </MessagesProvider>
  );
}
