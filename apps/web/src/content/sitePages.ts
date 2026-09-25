/**
 * CMS-editable marketing pages, grouped exactly like the footer. The admin
 * Pages section lists this registry; each entry renders a `site_pages` row
 * (BlockNote body) in a fixed slot on its route. Only registered slugs are
 * editable — no route sprawl.
 *
 * Modes:
 * - `body` — the CMS html REPLACES the page's prose body (resources, legal).
 * - `section` — the CMS html renders as an extra content section in a fixed
 *   slot; the page's design is untouched when no row exists.
 */
export type SitePageGroup = 'Product' | 'Channels' | 'Resources' | 'Company';

export interface SitePageDef {
  slug: string;
  label: string;
  group: SitePageGroup;
  route: string;
  mode: 'body' | 'section';
  hint: string;
}

const CHANNEL_SLUGS = [
  { slug: 'integrations/facebook', label: 'Facebook', route: '/integrations/facebook' },
  { slug: 'integrations/instagram', label: 'Instagram', route: '/integrations/instagram' },
  { slug: 'integrations/threads', label: 'Threads', route: '/integrations/threads' },
  { slug: 'integrations/tiktok', label: 'TikTok', route: '/integrations/tiktok' },
  { slug: 'integrations/x', label: 'X', route: '/integrations/x' },
  { slug: 'integrations/bluesky', label: 'Bluesky', route: '/integrations/bluesky' },
  { slug: 'integrations/mastodon', label: 'Mastodon', route: '/integrations/mastodon' },
  { slug: 'integrations/linkedin', label: 'LinkedIn', route: '/integrations/linkedin' },
  { slug: 'integrations/youtube', label: 'YouTube', route: '/integrations/youtube' },
  { slug: 'integrations/pinterest', label: 'Pinterest', route: '/integrations/pinterest' },
];

const RESOURCE_SLUGS = [
  { slug: 'resources/launch-day-social-playbook', label: 'Launch day social playbook', route: '/resources/launch-day-social-playbook' },
  { slug: 'resources/social-media-glossary', label: 'Social media glossary', route: '/resources/social-media-glossary' },
  { slug: 'resources/social-media-manager-onboarding', label: 'Onboarding a social media manager', route: '/resources/social-media-manager-onboarding' },
];

export const SITE_PAGES: SitePageDef[] = [
  { slug: 'publish', label: 'Publish', group: 'Product', route: '/publish', mode: 'section', hint: 'Extra content section under the hero.' },
  { slug: 'features/create', label: 'Create', group: 'Product', route: '/features/create', mode: 'section', hint: 'Extra content section under the hero.' },
  { slug: 'ai-assistant', label: 'AI Assistant', group: 'Product', route: '/ai-assistant', mode: 'section', hint: 'Extra content section under the hero.' },
  { slug: 'pricing', label: 'Pricing', group: 'Product', route: '/pricing', mode: 'section', hint: 'Extra content section under the hero.' },
  ...CHANNEL_SLUGS.map((c) => ({
    ...c,
    group: 'Channels' as SitePageGroup,
    mode: 'section' as const,
    hint: 'Extra section after the intro on the channel page.',
  })),
  ...RESOURCE_SLUGS.map((r) => ({
    ...r,
    group: 'Resources' as SitePageGroup,
    mode: 'body' as const,
    hint: 'Replaces the article body.',
  })),
  { slug: 'compare', label: 'Compare', group: 'Resources', route: '/compare', mode: 'section', hint: 'Extra content section under the hero.' },
  { slug: 'made-for-everyone', label: 'Made for everyone', group: 'Resources', route: '/made-for-everyone', mode: 'section', hint: 'Extra content section under the hero.' },
  { slug: 'transparency', label: 'Transparency', group: 'Resources', route: '/transparency', mode: 'section', hint: 'Extra content section under the hero.' },
  { slug: 'about', label: 'About', group: 'Company', route: '/about', mode: 'section', hint: 'Extra content section under the hero.' },
  { slug: 'terms', label: 'Terms of Use', group: 'Company', route: '/terms', mode: 'body', hint: 'Replaces the legal sections.' },
  { slug: 'privacy', label: 'Privacy Policy', group: 'Company', route: '/privacy', mode: 'body', hint: 'Replaces the legal sections.' },
];

export function sitePageDef(slug: string): SitePageDef | undefined {
  return SITE_PAGES.find((p) => p.slug === slug);
}

/** Slugs must stay URL- and table-safe (registry only, but enforced anyway). */
export function isValidSiteSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:[-\/][a-z0-9]+)*$/.test(slug);
}
