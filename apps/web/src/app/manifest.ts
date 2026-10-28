import type { MetadataRoute } from 'next';

/** Install metadata for browsers and the "Add to Home Screen" prompt. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sosial: social media scheduler',
    short_name: 'Sosial',
    description: 'Plan, write and publish to every social channel from one composer, calendar and queue.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: '/bolt.png', sizes: '288x384', type: 'image/png' },
    ],
  };
}
