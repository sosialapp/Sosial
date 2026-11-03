import { buildNav, docsContent, docsUrl, flatPages } from '@/lib/docs';

// Admin saves purge /docs, this is the fallback.
export const revalidate = 3600;

/** docs.sosial.app/llms-full.txt: every published docs page's markdown in
 *  sidebar order, so an AI engine can read the whole manual in one fetch. */
export async function GET() {
  const base = docsUrl();
  const { sections, pages } = await docsContent();
  const bySlug = new Map(pages.map((p) => [p.slug, p]));

  const parts = flatPages(buildNav(sections, pages)).map(({ slug, title }) => {
    const p = bySlug.get(slug);
    const desc = p?.description ? `\n\n> ${p.description}` : '';
    return `# ${title}\n\nSource: ${base}/${slug}${desc}\n\n${(p?.bodyMd ?? '').trim()}`;
  });

  const body = `# Sosial Docs (full text)\n\n${parts.join('\n\n---\n\n')}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
