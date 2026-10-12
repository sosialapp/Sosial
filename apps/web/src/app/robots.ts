import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/account',
          '/analytics',
          '/billing',
          '/calendar',
          '/calendar-day',
          '/calendar-line',
          '/calendar-list',
          '/calendar-month',
          '/calendar-year',
          '/channels',
          '/composer',
          '/connect',
          '/create',
          '/dashboard',
          '/import',
          '/invite/',
          '/login',
          '/auth/',
          '/new',
          '/post',
          '/post-ideas',
          '/post-publish',
          '/post-templates',
          '/profile',
          '/queue',
          '/team',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
