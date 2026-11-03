import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app';

/** AI search and answer crawlers, named so it is explicit that they are
 *  welcome on the public site. They get the same app-route exclusions as
 *  everyone else; a named group replaces `*` for that bot, so it repeats them. */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Bingbot',
  'CCBot',
];

const DISALLOW = [
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
  '/post-import',
  '/post-publish',
  '/post-templates',
  '/profile',
  '/queue',
  '/team',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: DISALLOW },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
