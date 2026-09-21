import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app'),
  title: {
    default: 'Sosial — Social Media Scheduler & Management for Every Channel',
    template: '%s · Sosial',
  },
  description:
    'Plan, write and publish social media posts across X, Instagram, TikTok, Facebook, Threads, Bluesky, Mastodon, LinkedIn, YouTube and Pinterest — from one composer, calendar and queue.',
  icons: { icon: '/bolt.png' },
  openGraph: {
    type: 'website',
    siteName: 'Sosial',
    title: 'Sosial — Social Media Scheduler & Management for Every Channel',
    description:
      'Plan, write and publish across ten social networks from one composer, calendar and queue — with an AI writer and approvals built in.',
    images: ['/bolt.png'],
  },
  twitter: { card: 'summary', images: ['/bolt.png'] },
};

export const viewport: Viewport = {
  themeColor: '#f2ede2',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sosial-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@200;500&family=Plus+Jakarta+Sans:wght@200;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
