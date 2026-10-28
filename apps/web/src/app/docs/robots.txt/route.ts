import { docsUrl } from '@/lib/docs';

/** docs.sosial.app/robots.txt. The root robots.ts belongs to sosial.app and
 *  points at its sitemap, so the docs host gets its own (via the middleware). */
export function GET() {
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${docsUrl()}/sitemap.xml\nHost: ${docsUrl()}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
