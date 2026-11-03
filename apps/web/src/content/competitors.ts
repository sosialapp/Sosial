/**
 * Head-to-head pages at /compare/<slug>: "Sosial vs Buffer" and the
 * "<tool> alternative" searches. Claims about other tools stay structural
 * (how they price, what they are known for), never exact prices, which move
 * every few months. Re-check each entry against the tool's own pricing page
 * when `reviewed` gets old, and bump the date.
 */

export interface Competitor {
  slug: string;
  name: string;
  /** ISO date the facts below were last checked. */
  reviewed: string;
  /** One-line answer for the hero: who should pick which. */
  verdict: string;
  /** Opening paragraph, written to be quotable on its own. */
  summary: string;
  /** Side-by-side rows: [label, Sosial, them]. */
  rows: [string, string, string][];
  /** Where the other tool is the better pick. */
  pickThem: string[];
  /** Where Sosial is the better pick. */
  pickSosial: string[];
  faqs: { q: string; a: string }[];
}

/** Rows every page shares on the Sosial side; each competitor fills in its own column. */
const SOSIAL = {
  pricing: 'Flat plans: Free, Solo $12, Team $29, Business $79 a month',
  free: 'Yes: 3 channels, 10 scheduled posts per channel, 20 AI credits a month',
  networks:
    'Instagram, TikTok, X, Facebook, Threads, LinkedIn, YouTube, Pinterest, Bluesky, Mastodon, Telegram, Discord, VK, WordPress, Ghost, Dev.to, Hashnode',
  ai: 'AI writer with live research and linked sources, in 100+ languages',
  api: 'REST API and an MCP server for AI agents',
  apps: 'Web, iOS and Android',
};

export const COMPETITORS: Competitor[] = [
  {
    slug: 'buffer',
    name: 'Buffer',
    reviewed: '2026-11-03',
    verdict:
      'Pick Buffer for a simple, well-known scheduler on a few channels. Pick Sosial if you post to many channels, want blogs and newer networks in the same calendar, or are tired of paying per channel.',
    summary:
      'Buffer and Sosial are both schedulers for people who mainly write and publish posts. The biggest difference is pricing: Buffer charges per connected channel, so the bill grows with every network you add, while Sosial plans are flat and include a set number of channels. Sosial also publishes to blogs (WordPress, Ghost, Dev.to, Hashnode) and community channels (Telegram, Discord) from the same composer, and offers an MCP server so AI agents can draft and schedule posts.',
    rows: [
      ['Pricing model', SOSIAL.pricing, 'Per connected channel, per month'],
      ['Free plan', SOSIAL.free, 'Yes: 3 channels, 10 scheduled posts per channel'],
      ['Networks', SOSIAL.networks, 'The major social networks; check Buffer for the current list'],
      ['AI writing', SOSIAL.ai, 'AI Assistant for drafting and rewriting'],
      ['Developer access', SOSIAL.api, 'Check Buffer for current API access'],
      ['Apps', SOSIAL.apps, 'Web, iOS and Android'],
    ],
    pickThem: [
      'You only manage two or three channels and want a tool with a long track record.',
      'You want a link-in-bio page (Buffer Start Page) from the same vendor.',
    ],
    pickSosial: [
      'You manage many channels and per-channel pricing adds up.',
      'You publish to blogs, Telegram, Discord or Bluesky alongside social posts.',
      'You want AI agents (Claude, ChatGPT, Cursor) to schedule posts through MCP.',
    ],
    faqs: [
      {
        q: 'Is Sosial a good Buffer alternative?',
        a: 'Yes, if you post to more than a few channels. Sosial covers the same core jobs (composer, calendar, queue, approvals, analytics) with flat plans instead of per-channel pricing, and adds blogs, community channels and an MCP server.',
      },
      {
        q: 'Is Sosial cheaper than Buffer?',
        a: 'It depends on how many channels you connect. Buffer charges per channel, so the more networks you use, the more a flat Sosial plan saves. With one or two channels the two cost about the same. Compare both pricing pages for your exact channel count.',
      },
      {
        q: 'Do Buffer and Sosial both have a free plan?',
        a: 'Yes. Both free plans allow 3 channels and 10 scheduled posts per channel. The Sosial free plan also includes 20 AI credits a month and a watermark; X (Twitter) needs a paid Sosial plan.',
      },
      {
        q: 'Can I move from Buffer to Sosial?',
        a: 'Yes. Connect the same accounts in Sosial, then recreate your posting schedule in the calendar. Your published history stays on each network.',
      },
    ],
  },
  {
    slug: 'hootsuite',
    name: 'Hootsuite',
    reviewed: '2026-11-03',
    verdict:
      'Pick Hootsuite if you need social listening, ad management and enterprise reporting. Pick Sosial if your job is writing, scheduling and publishing posts and you want a free plan and month-to-month prices.',
    summary:
      'Hootsuite is an all-in-one social media suite built for larger marketing teams, with social listening, ad management and enterprise reporting. Sosial focuses on composing, scheduling, approving and publishing across networks. Hootsuite has no permanent free plan and prices per user, billed annually; Sosial has a free plan and flat monthly plans, and adds blogs, community channels and an MCP server for AI agents.',
    rows: [
      ['Pricing model', SOSIAL.pricing, 'Per user, billed annually'],
      ['Free plan', SOSIAL.free, 'No; free trial on paid plans'],
      ['Social listening', 'No', 'Yes'],
      ['Ad management', 'No', 'Yes'],
      ['Networks', SOSIAL.networks, 'The major social networks; check Hootsuite for the current list'],
      ['AI writing', SOSIAL.ai, 'OwlyWriter AI'],
      ['Developer access', SOSIAL.api, 'Check Hootsuite for current API access'],
    ],
    pickThem: [
      'You need social listening and brand monitoring.',
      'You run paid social and want ads managed next to organic posts.',
      'You need enterprise reporting, SSO and procurement-friendly contracts.',
    ],
    pickSosial: [
      'Your work is writing posts and getting them out on time, not listening or ads.',
      'You want a free plan or monthly billing instead of an annual per-user contract.',
      'You publish to blogs, Telegram, Discord, Bluesky or Mastodon too.',
    ],
    faqs: [
      {
        q: 'Is Sosial a good Hootsuite alternative?',
        a: 'Yes, for teams whose work is publishing rather than listening or ads. Sosial covers composing, scheduling, approvals, analytics and a comments inbox, with a free plan and flat monthly prices. If you rely on social listening or ad management, Hootsuite is the better fit.',
      },
      {
        q: 'Does Hootsuite have a free plan?',
        a: 'No. Hootsuite offers a free trial on its paid plans but no permanent free plan. Sosial has a free plan with 3 channels.',
      },
      {
        q: 'What does Hootsuite do that Sosial does not?',
        a: 'Social listening, ad management and enterprise reporting. Sosial does not offer those.',
      },
      {
        q: 'Can a team use Sosial instead of Hootsuite?',
        a: 'Yes. The Team plan includes 5 members, 3 workspaces and approval workflows with roles; Business has unlimited members and 6 workspaces.',
      },
    ],
  },
  {
    slug: 'later',
    name: 'Later',
    reviewed: '2026-11-03',
    verdict:
      'Pick Later for Instagram-first visual planning, link in bio and influencer campaigns. Pick Sosial if you publish text and video across many networks, including blogs and communities, from one composer.',
    summary:
      'Later started as an Instagram planner and is still strongest for visual brands: a drag-and-drop grid preview, Linkin.bio pages and influencer marketing. Sosial is built for publishing one idea to many networks, with each network\'s real character limit checked before you schedule. Later prices by "social set" (one account per network); Sosial plans are flat with a set number of channels, and include a free plan.',
    rows: [
      ['Pricing model', SOSIAL.pricing, 'Per "social set" (one account per network)'],
      ['Free plan', SOSIAL.free, 'Check Later for current free or trial options'],
      ['Best known for', 'One composer for many networks, blogs and communities', 'Instagram visual planning and link in bio'],
      ['Influencer marketing', 'No', 'Yes'],
      ['Networks', SOSIAL.networks, 'The major social networks; check Later for the current list'],
      ['AI writing', SOSIAL.ai, 'AI caption writer'],
      ['Developer access', SOSIAL.api, 'Check Later for current API access'],
    ],
    pickThem: [
      'Instagram is your main channel and you plan by how the grid will look.',
      'You want link in bio and influencer campaigns from the same vendor.',
    ],
    pickSosial: [
      'You post to many networks, including X, Threads, LinkedIn, Bluesky and Mastodon.',
      'You also publish to blogs or to Telegram and Discord communities.',
      'You want a free plan or AI agents scheduling through MCP.',
    ],
    faqs: [
      {
        q: 'Is Sosial a good Later alternative?',
        a: 'Yes, if you publish across many networks rather than mainly Instagram. Sosial checks each network\'s character limit live, publishes from the cloud with the app closed, and includes blogs and community channels. For Instagram grid planning and influencer campaigns, Later is the stronger pick.',
      },
      {
        q: 'Does Sosial publish Instagram Reels and carousels?',
        a: 'Yes. Attach up to 20 images or videos for a carousel, or one vertical video for a Reel, to an Instagram business account.',
      },
      {
        q: 'How is pricing different?',
        a: 'Later prices by social set, one account per network. Sosial plans include a number of channels (3 free, 6 on Solo, 25 on Team, 100 on Business) regardless of which networks they are.',
      },
    ],
  },
];

export function competitor(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}

export function competitorHref(slug: string) {
  return `/compare/${slug}`;
}
