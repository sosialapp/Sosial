import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app'),
  title: {
    default: 'Sosial — Every channel. One calendar.',
    template: '%s · Sosial',
  },
  description:
    'Write once, schedule everywhere. Sosial publishes to ten channels from one shared calendar — with an AI writer, approvals and a queue that runs itself.',
  icons: { icon: '/bolt.png' },
  openGraph: {
    type: 'website',
    siteName: 'Sosial',
    title: 'Sosial — Every channel. One calendar.',
    description:
      'Write once, schedule everywhere. Ten channels from one shared calendar, with an AI writer, approvals and a queue that runs itself.',
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
