import { cache } from 'react';
import { createClient as createAnonClient } from '@supabase/supabase-js';
import { markdownToPlain } from './docsMarkdown';
import { LEGAL_SECTION, legalDocsPages } from './docsLegal';

/**
 * Public read side of the docs site (docs.sosial.app). Cookie-free anon
 * client like lib/sitePages: RLS only admits published pages here, so drafts
 * never reach the public site even if a query forgets to filter.
 */

export interface DocsSection {
  id: string;
  slug: string;
  title: string;
  position: number;
}

export interface DocsPage {
  id: string;
  sectionId: string;
  /** Parent page in the same section (one level of nesting), or null. */
  parentId: string | null;
  slug: string;
  title: string;
  description: string;
  bodyMd: string;
  position: number;
  published: boolean;
  /** See DocsIcon: 'brand:<provider>' or a docs icon name; '' for the default. */
  icon: string;
  updatedAt: string | null;
}

export interface DocsNavPage {
  slug: string;
  title: string;
  icon: string;
  children: DocsNavPage[];
}

export interface DocsNavSection {
  slug: string;
  title: string;
  pages: DocsNavPage[];
}

export interface DocsSearchEntry {
  slug: string;
  title: string;
  section: string;
  description: string;
  headings: string[];
  text: string;
}

export { docsUrl } from './site';

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function publicClient() {
  return createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type SectionRow = { id: string; slug: string; title: string; position: number };
type PageRow = {
  id: string;
  section_id: string;
  parent_id?: string | null;
  slug: string;
  title: string;
  description: string | null;
  body_md: string | null;
  position: number;
  published: boolean;
  icon?: string | null;
  updated_at: string | null;
};

export const SECTION_COLUMNS = 'id, slug, title, position';
export const PAGE_COLUMNS = 'id, section_id, parent_id, slug, title, description, body_md, position, published, icon, updated_at';
/** Columns before P113 (icons, nesting): the read falls back to these so a
 *  deploy that lands before the migration still shows every page. */
const LEGACY_PAGE_COLUMNS = 'id, section_id, slug, title, description, body_md, position, published, updated_at';

export function toSection(r: SectionRow): DocsSection {
  return { id: r.id, slug: r.slug, title: r.title, position: r.position };
}

export function toPage(r: PageRow): DocsPage {
  return {
    id: r.id,
    sectionId: r.section_id,
    parentId: r.parent_id ?? null,
    slug: r.slug,
    title: r.title,
    description: r.description ?? '',
    bodyMd: r.body_md ?? '',
    position: r.position,
    published: r.published,
    icon: r.icon ?? '',
    updatedAt: r.updated_at,
  };
}

type Sb = ReturnType<typeof publicClient>;

/** Every section and page the client may see, in position order. Shared by
 *  the public site (anon: published only) and the admin (RLS: everything). */
export async function readDocs(
  sb: Pick<Sb, 'from'>,
  publishedOnly: boolean,
): Promise<{ sections: DocsSection[]; pages: DocsPage[] }> {
  const run = (sCols: string, pCols: string) => {
    let pq = sb.from('docs_pages').select(pCols).order('position').order('title');
    if (publishedOnly) pq = pq.eq('published', true);
    return Promise.all([sb.from('docs_sections').select(sCols).order('position').order('title'), pq]);
  };
  let [s, p] = await run(SECTION_COLUMNS, PAGE_COLUMNS);
  if (s.error || p.error) [s, p] = await run(SECTION_COLUMNS, LEGACY_PAGE_COLUMNS);
  return {
    sections: ((s.data ?? []) as unknown as SectionRow[]).map(toSection),
    pages: ((p.data ?? []) as unknown as PageRow[]).map(toPage),
  };
}

/** Sections and published pages in sidebar order, plus the code-built Legal
 *  section (Terms, Privacy) at the end. One read per request. */
export const docsContent = cache(async (): Promise<{ sections: DocsSection[]; pages: DocsPage[] }> => {
  let db: { sections: DocsSection[]; pages: DocsPage[] } = { sections: [], pages: [] };
  try {
    db = await readDocs(publicClient(), true);
  } catch {
    /* the Legal pages still render */
  }
  // A docs_pages row with the same slug wins over the built-in page.
  const legal = legalDocsPages().filter((p) => !db.pages.some((d) => d.slug === p.slug));
  return {
    sections: legal.length ? [...db.sections, LEGAL_SECTION] : db.sections,
    pages: [...db.pages, ...legal],
  };
});

/** Sidebar tree: sections, their top-level pages, and each page's children.
 *  A child whose parent isn't published (or sits in another section) is shown
 *  at the top level. Sections with no published page are hidden. */
export function buildNav(sections: DocsSection[], pages: DocsPage[]): DocsNavSection[] {
  return sections
    .map((s) => {
      const own = pages.filter((p) => p.sectionId === s.id);
      const ids = new Set(own.map((p) => p.id));
      const node = (p: DocsPage): DocsNavPage => ({
        slug: p.slug,
        title: p.title,
        icon: p.icon,
        children: own.filter((c) => c.parentId === p.id).map((c) => ({ slug: c.slug, title: c.title, icon: c.icon, children: [] })),
      });
      return {
        slug: s.slug,
        title: s.title,
        pages: own.filter((p) => !p.parentId || !ids.has(p.parentId)).map(node),
      };
    })
    .filter((s) => s.pages.length > 0);
}

/** Pages flattened in reading order, parents before their children (prev/next,
 *  sitemap, the docs home). */
export function flatPages(nav: DocsNavSection[]): { slug: string; title: string; icon: string; section: string }[] {
  return nav.flatMap((s) =>
    s.pages.flatMap((p) => [p, ...p.children].map((x) => ({ slug: x.slug, title: x.title, icon: x.icon, section: s.title }))),
  );
}

export function buildSearchIndex(sections: DocsSection[], pages: DocsPage[]): DocsSearchEntry[] {
  const titleOf = new Map(sections.map((s) => [s.id, s.title]));
  return pages.map((p) => ({
    slug: p.slug,
    title: p.title,
    section: titleOf.get(p.sectionId) ?? '',
    description: p.description,
    headings: [...p.bodyMd.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].trim()),
    // Capped so the index shipped to the browser stays small.
    text: markdownToPlain(p.bodyMd).slice(0, 4000),
  }));
}

export async function docsPage(slug: string): Promise<DocsPage | null> {
  const { pages } = await docsContent();
  return pages.find((p) => p.slug === slug) ?? null;
}

/** Paths to purge after an admin write. Docs render under /docs internally. */
export function docsRevalidatePaths(slugs: string[]): string[] {
  return ['/docs', '/docs/sitemap.xml', ...slugs.filter(Boolean).map((s) => `/docs/${s}`)];
}
