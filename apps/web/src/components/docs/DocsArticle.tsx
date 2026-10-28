import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { DocsPage } from '@/lib/docs';
import { renderDocMarkdown } from '@/lib/docsMarkdown';
import DocsCopyButtons from './DocsCopyButtons';
import DocsCopyPage from './DocsCopyPage';
import DocsIcon from './DocsIcon';

type Neighbor = { slug: string; title: string; icon: string } | null;

/** One docs page: title, rendered markdown, prev/next and the outline rail. */
export default function DocsArticle({
  page,
  section,
  prev,
  next,
}: {
  page: DocsPage;
  section: string;
  prev: Neighbor;
  next: Neighbor;
}) {
  const { html, headings } = renderDocMarkdown(page.bodyMd);
  // Fixed zone so the server-rendered time never differs from the client's.
  const updated = page.updatedAt
    ? `${new Date(page.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`
    : null;
  const markdown = `# ${page.title}

${page.description ? `${page.description}

` : ''}${page.bodyMd}`;

  return (
    <div className="flex min-w-0 flex-1 gap-10 px-4 pb-24 pt-8 sm:px-8 lg:px-12">
      <article className="min-w-0 max-w-3xl flex-1">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink/55">{section}</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="flex items-center gap-3 font-display text-3xl font-medium tracking-tight sm:text-4xl">
            {page.icon.startsWith('brand:') ? <DocsIcon name={page.icon} className="h-8 w-8 shrink-0" /> : null}
            {page.title}
          </h1>
          <DocsCopyPage markdown={markdown} />
        </div>
        {page.description ? <p className="mt-3 text-lg leading-relaxed text-ink/70">{page.description}</p> : null}
        <div id="docs-body" className="docs-prose mt-8" dangerouslySetInnerHTML={{ __html: html }} />
        <DocsCopyButtons />
        {updated ? <p className="mt-12 text-sm text-ink/60">Last updated: {updated}</p> : null}
        <nav aria-label="Previous and next" className="mt-6 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={`/${prev.slug}`} className="group rounded-2xl border border-line p-4 transition hover:border-ink/40">
              <span className="flex items-center gap-1 text-xs text-ink/60">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous
              </span>
              <span className="mt-1 flex items-center gap-2 font-medium">
                <DocsIcon name={prev.icon} fallback className="h-4 w-4 shrink-0 text-ink/60" />
                {prev.title}
              </span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next ? (
            <Link href={`/${next.slug}`} className="group rounded-2xl border border-line p-4 text-right transition hover:border-ink/40">
              <span className="flex items-center justify-end gap-1 text-xs text-ink/60">
                Next <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="mt-1 flex items-center justify-end gap-2 font-medium">
                <DocsIcon name={next.icon} fallback className="h-4 w-4 shrink-0 text-ink/60" />
                {next.title}
              </span>
            </Link>
          ) : null}
        </nav>
      </article>
      {headings.length ? (
        <aside className="sticky top-[92px] hidden max-h-[calc(100vh-120px)] w-52 shrink-0 self-start overflow-y-auto xl:block">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink/55">On this page</p>
          <ul className="mt-3 grid gap-1.5 border-l border-line text-sm">
            {headings.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className={`-ml-px block border-l border-transparent text-ink/70 transition hover:border-ink hover:text-ink ${
                    h.depth === 3 ? 'pl-6' : 'pl-3'
                  }`}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
