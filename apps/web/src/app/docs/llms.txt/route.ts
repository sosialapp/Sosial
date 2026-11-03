import { buildNav, docsContent, docsUrl } from '@/lib/docs';

// Admin saves purge /docs, this is the fallback.
export const revalidate = 3600;

/** docs.sosial.app/llms.txt (the middleware maps it onto /docs/llms.txt): the
 *  docs index in sidebar order, one line per page. The full text is at
 *  /llms-full.txt. */
export async function GET() {
  const base = docsUrl();
  const { sections, pages } = await docsContent();
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const line = (slug: string, title: string) => {
    const d = bySlug.get(slug)?.description;
    return `- [${title}](${base}/${slug})${d ? `: ${d}` : ''}`;
  };

  const body = `# Sosial Docs

> How to connect each channel to Sosial, schedule and publish posts, work as a team, and use the REST API and MCP server. Sosial is a social media scheduler: https://sosial.app (product overview: https://sosial.app/llms.txt).

Full text of every page: ${base}/llms-full.txt

${buildNav(sections, pages)
  .map(
    (s) =>
      `## ${s.title}\n\n${s.pages
        .flatMap((p) => [line(p.slug, p.title), ...p.children.map((c) => line(c.slug, c.title))])
        .join('\n')}`,
  )
  .join('\n\n')}
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
