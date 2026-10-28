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
4. **Vercel**: make sure `www.sosial.app` is attached to the project. It already serves today, so the new redirect takes effect as soon as this deploys.
5. **Image previews**: the root layout sets `max-image-preview: none`, which keeps Sosial's images out of Google Images, Discover and result thumbnails. That was a deliberate choice. Switching it to `large` usually lifts click-through; it's one line in `apps/web/src/app/layout.tsx`.

## Content that would move rankings most

- **Comparison pages** for high-intent searches: "Buffer alternative", "Hootsuite alternative", "Later alternative", "Sosial vs Buffer". Keep them factual, with a table like `/compare`.
- **Blog descriptions**: several posts have descriptions under 70 characters. Write fuller ones in Admin → Blog, 120–155 characters with the main keyword. The shortest:
  - "Client approvals for agencies"
  - "Automation vs scheduling"
  - "What a publishing queue is"
- **Listings that earn links**: Product Hunt, AlternativeTo, G2, Capterra, SaaSHub, plus "built with" or partner pages for the platforms you integrate with.
- **Docs depth**: each channel page already ranks for "connect X to Sosial". Adding troubleshooting sections (error messages people search for) brings long-tail traffic.
