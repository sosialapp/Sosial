import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import '@schedule-x/theme-default/dist/index.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app'),
  title: {
    default: 'Sosial: Schedule and manage social media',
    template: '%s · Sosial',
  },
  description:
    'Plan, write and publish to X, Instagram, TikTok, Facebook, Threads, Bluesky, Mastodon, LinkedIn, YouTube and Pinterest, one composer, calendar and queue.',
  icons: { icon: '/bolt.png' },
  // No image thumbnails in Google results (max-image-preview:none). Social
  // link previews are unaffected, they keep using the opengraph images.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'none',
    },
  },
  // Social images resolve from the generated opengraph-image routes
  // (root brand card + per-article cards), no static images here.
  openGraph: {
    type: 'website',
    siteName: 'Sosial',
    title: 'Sosial: Schedule and manage social media',
    description:
      'Plan, write and publish across ten social networks from one composer, calendar and queue, with an AI writer and approvals built in.',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;500&family=Plus+Jakarta+Sans:wght@300;500&family=Space+Grotesk:wght@400;700&family=Playfair+Display:wght@400;700;900&family=Crimson+Pro:wght@400;700&family=Poppins:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Anton&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
