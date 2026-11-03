# SEO for sosial.app and docs.sosial.app

## What the code does

- **One metadata helper** (`apps/web/src/lib/seo.ts`). Every public page gets:
  - a keyword-led `<title>` that fits Google's ~60 characters
  - a description of 160 characters or fewer
  - a canonical URL
  - Open Graph tags (with `og:url` and a 1200×630 card)
  - a Twitter card

  CMS "meta title" and "meta description" (Admin → Pages) still override the defaults.
- **Share cards**:
  - `/og?t=&k=&c=` renders a branded card for any page, with the channel logo on integration and docs channel pages.
  - The homepage and blog posts keep their own `opengraph-image` routes.
- **Structured data** (JSON-LD):
  - every page: Organization (with legal name and support contact), WebSite, and SoftwareApplication (feature list, screenshot and an AggregateOffer built from the price book in `lib/billing/plans.ts`)
  - product pages: BreadcrumbList
  - blog index: Blog
  - blog posts: Article (image, publish and modified dates, section) and BreadcrumbList
  - integration pages: BreadcrumbList
  - FAQ blocks: FAQPage
  - docs pages: TechArticle and BreadcrumbList
  - docs home: WebSite
- **Integration pages** target the searches people make: the title is "Instagram scheduler: schedule Instagram posts" and the H1 is "Schedule Instagram posts with Sosial". Each page links to its setup page in the docs.
- **One host per site**: `www.` redirects permanently (308) to the apex in the middleware.
- **Sitemaps**:
  - `sosial.app/sitemap.xml` sets `lastmod` only where a real edit date exists (posts, CMS pages) and lists blog cover images. Terms and Privacy are left out: their canonical copies are on the docs host.
  - `docs.sosial.app/sitemap.xml` lists every docs page, including Terms and Privacy.
- **Robots**: each host serves its own `robots.txt` pointing at its own sitemap. App routes are disallowed on the main host.
- **Install metadata**: `manifest.webmanifest` and a square `apple-icon`.
- **AI answer engines (AEO)**:
  - `sosial.app/llms.txt` is a markdown map of the site (what Sosial is, plans from the price book, channels, comparisons, resources, blog). `docs.sosial.app/llms.txt` indexes the docs, and `/llms-full.txt` there has every docs page's full text.
  - `robots.txt` names the AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended and others) and allows them on the public site, with the same app-route exclusions. Check that the CDN or proxy doesn't block them with bot protection.
  - Organization `sameAs` (`SAME_AS` in `components/site/JsonLd.tsx`) lists Sosial's own profiles elsewhere. Add each official social, app store and review-site profile there.
  - Head-to-head pages at `/compare/<tool>` (`content/competitors.ts`) answer "Sosial vs X" and "X alternative" searches. Claims about other tools stay structural (pricing model, what they are known for), never exact prices. Re-check them against each tool's pricing page every few months and bump `reviewed`.

## Do these once (off-site)

1. **Google Search Console**: add a **Domain property** for `sosial.app`. The DNS TXT record covers the apex, www and docs at once. Then submit both sitemaps:
   - `https://sosial.app/sitemap.xml`
   - `https://docs.sosial.app/sitemap.xml`
2. **URL inspection → Request indexing** for:
   - the homepage
   - `/pricing`
   - `/integrations`
   - the five biggest integration pages (Instagram, TikTok, X, Facebook, LinkedIn)
3. **Bing Webmaster Tools**: "Import from Google Search Console". Bing also feeds DuckDuckGo and ChatGPT search.
4. **www redirect**: `www.sosial.app` must resolve to the same deployment as the apex; the app 308s it to `sosial.app`. Self-hosted that means the Caddy site block lists both hosts (`infra/SERVER.md`); on the Vercel rollback project it means the domain is attached there too.
5. **Image previews** are set to `max-image-preview: large` (root layout), so result thumbnails, Google Images and Discover can show Sosial's images.

## Content that would move rankings most

- **More comparison pages**: Buffer, Hootsuite and Later are live under `/compare/`. Next candidates: Metricool, Sprout Social, SocialPilot, Publer. Add an entry to `content/competitors.ts`.
- **Blog descriptions**: several posts have descriptions under 70 characters. Write fuller ones in Admin → Blog, 120–155 characters with the main keyword. The shortest:
  - "Client approvals for agencies"
  - "Automation vs scheduling"
  - "What a publishing queue is"
- **Listings that earn links**: Product Hunt, AlternativeTo, G2, Capterra, SaaSHub, plus "built with" or partner pages for the platforms you integrate with.
- **Docs depth**: each channel page already ranks for "connect X to Sosial". Adding troubleshooting sections (error messages people search for) brings long-tail traffic.
