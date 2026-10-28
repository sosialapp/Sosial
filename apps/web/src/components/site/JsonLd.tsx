import { PLANS, PLAN_ORDER } from '@/lib/billing/plans';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app';

/** One Offer per public plan, straight from the price book. */
const OFFERS = PLAN_ORDER.map((k) => ({
  '@type': 'Offer',
  name: PLANS[k].label,
  price: String(PLANS[k].monthly.price),
  priceCurrency: 'USD',
  url: `${BASE}/pricing`,
  ...(PLANS[k].monthly.price > 0
    ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: PLANS[k].monthly.price, priceCurrency: 'USD', billingDuration: 'P1M' } }
    : {}),
}));

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
 *  Render once in the marketing layout. No ratings/reviews, only facts. */
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
            legalName: 'EGATE WORLDWIDE',
            url: BASE,
            logo: { '@type': 'ImageObject', url: `${BASE}/bolt.png`, width: 288, height: 384 },
            email: 'support@sosial.app',
            contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: 'support@sosial.app', availableLanguage: ['English'] },
            description:
              'Social media scheduler and management for Instagram, TikTok, X, Facebook, Threads, LinkedIn, YouTube, Pinterest, Bluesky, Mastodon, blogs and communities.',
          },
          {
            '@type': 'WebSite',
            '@id': `${BASE}/#website`,
            url: BASE,
            name: 'Sosial',
            publisher: { '@id': `${BASE}/#organization` },
            inLanguage: 'en',
            description: 'Schedule and publish to every social channel from one composer, calendar and queue.',
          },
          {
            '@type': 'SoftwareApplication',
            '@id': `${BASE}/#app`,
            name: 'Sosial',
            url: BASE,
            applicationCategory: 'BusinessApplication',
            applicationSubCategory: 'Social media management',
            operatingSystem: 'Web, iOS, Android',
            description:
              'Write once, schedule everywhere: a composer with per-channel previews and limits, a calendar and cloud queue, approvals, analytics and an AI writer.',
            screenshot: `${BASE}/hero-devices.png`,
            featureList: [
              'Schedule posts to Instagram, TikTok, X, Facebook, Threads, LinkedIn, YouTube and Pinterest',
              'Per-channel previews and character limits',
              'Content calendar and publishing queue',
              'AI writer with live research in 100+ languages',
              'Team approvals and roles',
              'Comments and messages inbox',
              'Analytics',
              'REST API and MCP server',
            ],
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'USD',
              lowPrice: String(Math.min(...PLAN_ORDER.map((k) => PLANS[k].monthly.price))),
              highPrice: String(Math.max(...PLAN_ORDER.map((k) => PLANS[k].monthly.price))),
              offerCount: OFFERS.length,
              offers: OFFERS,
            },
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
  modified,
  coverUrl,
  section,
}: {
  title: string;
  description: string;
  slug: string;
  date: string;
  /** Last edit, when known; falls back to the publish date. */
  modified?: string | null;
  coverUrl?: string | null;
  section?: string;
}) {
  return (
    <JsonLd
      id="ld-article"
      data={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE}/blog/${slug}` },
        url: `${BASE}/blog/${slug}`,
        // Google wants an image on every Article; the branded card always exists.
        image: [...(coverUrl ? [coverUrl] : []), `${BASE}/blog/${slug}/opengraph-image`],
        datePublished: date,
        dateModified: modified ?? date,
        inLanguage: 'en',
        ...(section ? { articleSection: section } : {}),
        isPartOf: { '@id': `${BASE}/#website` },
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

/** The blog index as a Blog with its posts, newest first. */
export function BlogJsonLd({ posts }: { posts: { slug: string; title: string; date: string }[] }) {
  return (
    <JsonLd
      id="ld-blog"
      data={{
        '@context': 'https://schema.org',
        '@type': 'Blog',
        '@id': `${BASE}/blog#blog`,
        url: `${BASE}/blog`,
        name: 'The Sosial blog',
        publisher: { '@id': `${BASE}/#organization` },
        blogPost: posts.slice(0, 50).map((p) => ({
          '@type': 'BlogPosting',
          headline: p.title,
          url: `${BASE}/blog/${p.slug}`,
          datePublished: p.date,
        })),
      }}
    />
  );
}
