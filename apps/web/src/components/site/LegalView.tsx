import Prose from '@/components/site/Prose';
import type { LegalDoc } from '@/content/legal';
import { formatPostDate } from '@/content/types';

/** Shared renderer for /terms and /privacy. */
export default function LegalView({ doc }: { doc: LegalDoc }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">{doc.title}</h1>
      <p className="mt-3 text-sm font-bold text-faint">Last updated {formatPostDate(doc.updated)}</p>
      <p className="mt-5 text-lg leading-relaxed text-muted">{doc.summary}</p>

      <hr className="my-10 border-line" />

      <div className="space-y-10">
        {doc.sections.map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-xl font-extrabold tracking-tight">{s.title}</h2>
            <Prose blocks={s.blocks} className="mt-3" />
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-muted">
        This page is written to be readable, not to replace legal advice. If you need the full
        agreement for a company account, contact us from inside your workspace.
      </p>
    </article>
  );
}
