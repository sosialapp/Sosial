import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import '@schedule-x/theme-default/dist/index.css';
import { LocaleProvider } from '@/lib/i18n/client';
import { dirOf } from '@/lib/i18n/locales';
import { getLocale } from '@/lib/i18n/server';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app'),
  title: {
    default: 'Sosial: Schedule and manage social media',
    template: '%s · Sosial',
  },
  description:
    'Plan, write and publish to X, Instagram, TikTok, Facebook, Threads, Bluesky, Mastodon, LinkedIn, YouTube and Pinterest, one composer, calendar and queue.',
  icons: { icon: '/bolt.png' },
  applicationName: 'Sosial',
  category: 'business',
  // Large image previews: thumbnails in results, Google Images and Discover.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  // Social images resolve from the generated opengraph-image routes
  // (root brand card + per-article cards), no static images here.
  openGraph: {
    type: 'website',
    siteName: 'Sosial',
    title: 'Sosial: Schedule and manage social media',
    description:
      'Plan, write and publish to Instagram, TikTok, X, Facebook, Threads, YouTube and more from one composer, calendar and queue, with an AI writer and approvals built in.',
  },
  twitter: { card: 'summary_large_image' },
};

// Self-hosted at build time: no render-blocking request to Google on the
// critical path, and size-adjusted fallbacks keep text from shifting on swap.
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--font-inter',
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${inter.variable} ${jakarta.variable}`}>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
