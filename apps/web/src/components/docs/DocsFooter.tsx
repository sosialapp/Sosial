import Image from 'next/image';
import Link from 'next/link';

export interface DocsFooterColumn {
  title: string;
  pages: { slug: string; title: string }[];
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app').replace(/\/+$/, '');

/** Footer on every docs page: docs columns, then the main site. */
export default function DocsFooter({ columns }: { columns: DocsFooterColumn[] }) {
  const site = [
    { label: 'Website', href: SITE },
    { label: 'Pricing', href: `${SITE}/pricing` },
    { label: 'Blog', href: `${SITE}/blog` },
    { label: 'Status', href: 'https://status.sosial.app/status/sosial' },
    { label: 'Terms', href: `${SITE}/terms` },
    { label: 'Privacy', href: `${SITE}/privacy` },
  ];
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 md:grid-cols-3 2xl:grid-cols-[1.4fr_repeat(5,1fr)] lg:px-10">
        <div>
          <Link href="/" className="flex items-center gap-2" aria-label="Sosial Docs home">
            <Image src="/bolt.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" />
            <span className="font-display text-lg font-medium tracking-tight">Sosial</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink/65">
            Plan, write and publish to every social channel from one composer and calendar.
          </p>
          <a href="mailto:support@sosial.app" className="mt-3 inline-block text-sm text-ink/75 underline underline-offset-4 hover:text-ink">
            support@sosial.app
          </a>
        </div>
        {columns.map((s) => (
          <nav key={s.title} aria-label={s.title}>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink/55">{s.title}</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {s.pages.slice(0, 8).map((p) => (
                <li key={p.slug}>
                  <Link href={`/${p.slug}`} className="text-ink/75 hover:text-ink">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <nav aria-label="Sosial">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink/55">Sosial</p>
          <ul className="mt-3 grid gap-2 text-sm">
            {site.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="text-ink/75 hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-[1200px] px-4 py-5 text-xs text-ink/55 sm:px-6 lg:px-10">
          © {new Date().getFullYear()} Sosial · Operated by EGATE WORLDWIDE
        </p>
      </div>
    </footer>
  );
}
