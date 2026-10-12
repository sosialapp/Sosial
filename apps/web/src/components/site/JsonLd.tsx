const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app';

/** Raw JSON-LD script. `id` keeps React from duplicating it on navigation. */
export function JsonLd({ id, data }: { id: string; data: Record<string, unknown> }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Sitewide entity graph: Organization + WebSite + SoftwareApplication.
 *  Render once in the marketing layout. No ratings/reviews — only facts. */
export function SiteJsonLd() {
  return (
    <JsonLd
      id="ld-site"
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${BASE}/#organization`,
            name: 'Sosial',
            url: BASE,
            logo: `${BASE}/bolt.png`,
            description:
              'Social media scheduler and management for X, Instagram, TikTok, Facebook, Threads, Bluesky, Mastodon, LinkedIn, YouTube and Pinterest.',
          },
          {
            '@type': 'WebSite',
            '@id': `${BASE}/#website`,
            url: BASE,
            name: 'Sosial',
            publisher: { '@id': `${BASE}/#organization` },
            inLanguage: 'en',
          },
          {
            '@type': 'SoftwareApplication',
            '@id': `${BASE}/#app`,
            name: 'Sosial',
            url: BASE,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web, iOS, Android',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            publisher: { '@id': `${BASE}/#organization` },
          },
        ],
      }}
    />
  );
}

/** FAQ rich results. Rendered inside the shared FaqList, so every marketing
 *  page with visible Q&As automatically qualifies. */
export function FaqJsonLd({ items }: { items: { q: string; a: string }[] }) {
  if (!items.length) return null;
  return (
    <JsonLd
      id="ld-faq"
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }}
    />
  );
}

/** Article rich results for a blog post. */
export function ArticleJsonLd({
  title,
  description,
  slug,
  date,
  coverUrl,
}: {
  title: string;
  description: string;
  slug: string;
  date: string;
  coverUrl?: string | null;
}) {
  return (
    <JsonLd
      id="ld-article"
      data={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        mainEntityOfPage: `${BASE}/blog/${slug}`,
        ...(coverUrl ? { image: [coverUrl] } : {}),
        datePublished: date,
        author: { '@type': 'Organization', name: 'Sosial', url: BASE },
        publisher: {
          '@type': 'Organization',
          name: 'Sosial',
          url: BASE,
          logo: { '@type': 'ImageObject', url: `${BASE}/bolt.png` },
        },
      }}
    />
  );
}

/** Breadcrumb trail rich results. */
export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  if (!items.length) return null;
  return (
    <JsonLd
      id="ld-breadcrumb"
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: b.name,
          item: `${BASE}${b.path}`,
        })),
      }}
    />
  );
}
