import type { Block } from './types';
import { RESOURCES } from './resources';
import { PRIVACY, TERMS } from './legal';
import { CHANNEL_GUIDES } from './channels';
import { legacyToTipTap } from '@/lib/blogConvert';
import type { TipTapDoc } from '@/lib/blogConvert';

/**
 * The current hardcoded copy of every CMS-registered page, expressed as the
 * legacy block model. The admin page editor seeds new edits with these so
 * "edit a page" means editing what is live today, not a blank sheet. Saving
 * publishes the edited version; deleting the row restores these defaults.
 *
 * Static pages keep their designed layouts (hero, feature grids, cards,
 * tables, CTAs) — the seed carries their editorial copy so it can be edited
 * and re-published as the page's CMS section/body.
 */

type B = Block;

const hero = (title: string, lede: string): B[] => [{ t: 'h', c: title }, { t: 'p', c: lede }];
const faqBlocks = (faqs: { q: string; a: string }[]): B[] =>
  faqs.flatMap((f) => [{ t: 'h', c: f.q } as B, { t: 'p', c: f.a } as B]);

function publishBlocks(): B[] {
  return [
    ...hero(
      'Every post, on time, everywhere.',
      'Write once, drop it on the calendar, and let the queue ship all ten channels. No retyping per network, no 11pm manual posting.',
    ),
    { t: 'h', c: 'Calendar — one calendar for ten channels.' },
    {
      t: 'p',
      c: 'Drafts, the queue and approvals live on the same grid. Drag a post between days and every channel target moves with it. Nothing to re-enter, nothing to forget.',
    },
    {
      t: 'ul',
      c: [
        'See the whole week across every network at a glance',
        'Drafts sit beside scheduled posts until you commit them',
        'Approvals show exactly where they are in the flow',
      ],
    },
    { t: 'h', c: 'Queue — a queue that runs itself.' },
    {
      t: 'p',
      c: 'Schedule a post and the cloud worker publishes each channel inside a minute of its slot, even with the app closed and the laptop shut. Per-channel results land back in the queue so you always know what went out.',
    },
    {
      t: 'ul',
      c: [
        'Post now or schedule for later in the same composer',
        'Pause, edit or pull anything before its slot',
        'Every channel reports back: sent, publishing or failed',
      ],
    },
    { t: 'h', c: 'Limits — character limits, handled before you schedule.' },
    {
      t: 'p',
      c: 'Every network gets its real limit: 280 on X, 500 on Threads, 2,200 on Instagram and TikTok, all the way to 63,206 on Facebook. Counters count, bars fill, and over-long captions trim before they leave, not after.',
    },
    { t: 'h', c: 'Control — change your mind freely.' },
    {
      t: 'p',
      c: 'Plans shift. Edit a caption, swap the image, move the slot or pull the post entirely, up to the minute it ships. Disconnecting a channel pauses its queued items instead of failing them.',
    },
    ...faqBlocks([
      { q: 'Do I need my phone nearby for posts to go out?', a: 'No. Publishing runs on the cloud worker, not your device. Schedule from anywhere and close the app. Posts still ship on time.' },
      { q: 'Can I publish immediately instead of scheduling?', a: 'Yes. Post now and schedule later live in the same composer with the same channels, previews and results.' },
      { q: 'What happens if a platform is down at my slot?', a: 'That channel reports failed in the queue while the rest go out normally. Fix the connection and re-queue just the failed channel.' },
      { q: 'What happens if I disconnect a channel with posts queued?', a: 'Its queued items pause instead of failing. Reconnect and they resume. Nothing is lost.' },
      { q: 'How fast does publishing happen?', a: 'The worker ships every channel inside about a minute of the scheduled time, and each result lands back in the queue.' },
    ]),
  ];
}

function pricingBlocks(): B[] {
  return [
    ...hero(
      'Simple plans, published prices.',
      'Start free and stay free if that is enough. Upgrade when you want more channels, unlimited scheduling, the AI writer or approvals. Monthly or annual — annual gives you two months free.',
    ),
    { t: 'h', c: 'Free — $0 forever. Enough to replace posting by hand.' },
    {
      t: 'ul',
      c: [
        '3 connected channels',
        '10 scheduled posts per channel',
        '20 AI credits a month',
        'One calendar and queue',
        'Per-channel previews and live limits',
        'iOS, Android and web',
      ],
    },
    { t: 'h', c: 'Solo — $12/month or $120/year. Publish everywhere, every day.' },
    {
      t: 'ul',
      c: [
        '6 connected channels',
        'Unlimited scheduled posts',
        'AI writer with live research (500 credits a month)',
        'Templates and studio',
        'Analytics across every channel',
      ],
    },
    { t: 'h', c: 'Team — $29/month or $290/year. Draft together, approve in one tap.' },
    {
      t: 'ul',
      c: [
        'Everything in Solo',
        '25 connected channels',
        'Approvals and review notes',
        'Member, admin and owner roles',
        '5 team members and 5 workspaces',
        'Shared calendar for the whole team',
        '1,500 AI credits a month · Priority support',
      ],
    },
    { t: 'h', c: 'Business — $79/month or $790/year. Scale the whole operation.' },
    {
      t: 'ul',
      c: [
        'Everything in Team',
        '100 connected channels',
        '5,000 AI credits a month',
        'Unlimited seats for the whole crew',
        'Per-channel member roles',
        'Premium support',
      ],
    },
    { t: 'p', c: 'Prices in USD. Annual plans are billed once a year and give you two months free. Cancel any time, keep your data.' },
    ...faqBlocks([
      { q: 'What counts against the free plan limit?', a: 'Scheduled and sent posts. Drafts do not count, and neither do edits to a post before it ships.' },
      { q: 'Are there per-channel fees?', a: 'No. Connecting Instagram costs the same as connecting X. Every plan that includes a channel includes all of its features.' },
      { q: 'What happens if I hit the free limit mid-month?', a: 'New scheduling pauses; nothing already queued is lost. Upgrade and the queue picks up where it left off, or wait for the reset next month.' },
      { q: 'Can I switch plans or cancel?', a: 'Any time, from billing settings. Plan and billing-interval changes apply immediately and are prorated by Stripe; cancelling keeps your plan until the end of the current period.' },
      { q: 'Is the AI writer included?', a: 'On every plan — 20 credits a month on Free, then 500, 1,500 and 5,000 on Solo, Team and Business. Credits reset on the 1st.' },
      { q: 'Do you charge for team seats on Team or Business?', a: 'No — both are one flat price for the whole workspace: up to 5 members on Team, unlimited on Business.' },
      { q: 'How does annual billing work?', a: 'You pay once a year — annual costs the same as ten months, so you get two months free. AI credits still reset on the 1st of every month.' },
    ]),
  ];
}

function aiAssistantBlocks(): B[] {
  return [
    ...hero(
      'A writer that checks its facts.',
      'Rough thought in, post-ready caption out. Grounded by live research with linked sources, written in your style, in 100+ languages. Nothing publishes without you.',
    ),
    { t: 'h', c: 'Research — grounded, not guessed.' },
    {
      t: 'p',
      c: 'Turn on research and the writer searches the live web before drafting, then hands you the copy alongside the sources it used and flags anything uncertain. News-driven posts finally have receipts.',
    },
    {
      t: 'ul',
      c: ['Live web research before drafting', 'Sources returned with every draft', 'Uncertainties flagged instead of smoothed over'],
    },
    { t: 'h', c: 'Languages — your language first.' },
    {
      t: 'p',
      c: 'Language comes before everything else in the writer. Pick from 100+ and the draft mirrors your idea natively, from English and Melayu to Tamil and beyond. No English-first awkwardness.',
    },
    { t: 'h', c: 'Styles & threads — sound like you on a good day.' },
    {
      t: 'p',
      c: 'Pick a style card: breaking news, threads, teardowns, each with a live sample of what it produces. Long ideas become substantial multi-post threads, split for readability, never padded for length.',
    },
    {
      t: 'ul',
      c: ['Style cards with real output samples', 'Threads split where a reader would pause', 'Per-post images, topical or AI-generated'],
    },
    { t: 'h', c: 'Rewrite — second drafts on demand.' },
    {
      t: 'p',
      c: 'Paste anything (a rough note, a published post, a competitor you admire structurally) and get a rewrite in your voice, adapted per channel with limits respected. Your drafts stay yours; the assistant just sharpens them.',
    },
    ...faqBlocks([
      { q: 'Does the AI publish automatically?', a: 'Never. It drafts; you approve. Every word passes through you before it can be scheduled, let alone published.' },
      { q: 'Is my content used to train AI models?', a: 'No. Your briefs and drafts are not used to train models. See the privacy policy for the full statement.' },
      { q: 'Which languages are supported?', a: 'More than a hundred, chosen first before anything else is generated, so the draft is native, not translated.' },
      { q: 'What happens when facts are uncertain?', a: 'The writer says so: uncertainties are flagged and sources are linked, so you can verify before posting.' },
      { q: 'Can it adapt one idea to all ten channels?', a: 'Yes. Generate once, then adapt per channel with each network’s limits and conventions respected.' },
    ]),
  ];
}

function featuresCreateBlocks(): B[] {
  return [
    ...hero(
      'Start from a blank page less.',
      'One composer writes for ten networks at once, with live previews, honest character counts, reusable templates and media that fits everywhere.',
    ),
    { t: 'h', c: 'Composer — write once, preview everywhere.' },
    {
      t: 'p',
      c: 'Pick your channels and the composer shows each one the way it will actually appear, with a live counter against its real limit. No surprises after you hit schedule.',
    },
    {
      t: 'ul',
      c: [
        'Per-channel preview cards before anything ships',
        'Live counters against true platform limits',
        'Over-long captions trim before scheduling, not after',
      ],
    },
    { t: 'h', c: 'Templates — your greatest hits, reusable.' },
    {
      t: 'p',
      c: 'Starter templates cover launches, roundups and founder stories, and your own best posts become templates too. A proven structure beats a blank page every time.',
    },
    {
      t: 'ul',
      c: ['Starter templates for common post shapes', 'Save your own winners as templates', 'Pair with the caption-formulas cheat sheet'],
    },
    { t: 'h', c: 'Media — photos and video that fit each feed.' },
    {
      t: 'p',
      c: 'Attach up to four images or a video to any post, pull a real photo matched to your topic, or generate a cover image from a prompt. Each channel gets media in the shape it expects.',
    },
    {
      t: 'ul',
      c: ['Up to 4 images or video per post', 'Real topical photos when the camera roll is empty', 'AI cover images generated from a prompt'],
    },
    ...faqBlocks([
      { q: 'Do I have to rewrite my caption for each channel?', a: 'No. You write once; the composer adapts with per-channel previews and counters, and trims where a limit demands it.' },
      { q: 'Which media types can I attach?', a: 'Up to four images or a video per post, plus topical photos and AI-generated covers. Each channel page lists exactly what its network accepts.' },
      { q: 'Can I edit a post after scheduling it?', a: 'Yes. Edit the caption, swap media or move the slot any time before it ships.' },
      { q: 'What templates are included?', a: 'Starters for launches, roundups, founder stories and more, plus your own saved templates from posts that performed.' },
    ]),
  ];
}

function compareBlocks(): B[] {
  return [
    ...hero(
      'Where Sosial fits.',
      'Suites do a lot and charge for the lot. Single-network apps are light and stay in one lane. Posting by hand is free until it is 11pm. Here is the honest shape of each.',
    ),
    {
      t: 'table',
      head: true,
      c: [
        ['Capability', 'Sosial', 'Suites', 'Single-network apps', 'By hand'],
        ['Ten networks in one composer', '✓', '×', '×', '×'],
        ['Publishes with the app closed', '✓', '✓', '×', '×'],
        ['Live character limits before you schedule', '✓', '×', '✓', '×'],
        ['AI writer with linked sources', '✓', '×', '×', '×'],
        ['Approvals and roles', '✓', '×', '✓', '×'],
        ['Free plan that stays free', '✓', '×', '✓', '✓'],
        ['No per-channel paywall', '✓', '×', '✓', '×'],
        ['Works on iOS, Android and web', '✓', '✓', '×', '✓'],
      ],
    },
    {
      t: 'p',
      c: 'Categories, not a takedown: "suites" means the big all-in-one tools, and "single-network apps" means schedulers built around one platform. Features across that group change often, so check current plans before you buy anything, ours included.',
    },
    ...faqBlocks([
      { q: 'Why not just use a big suite?', a: 'If you need listening, ads and enterprise reporting, a suite may serve you better. If your job is writing posts and getting them out on ten networks on time, the suite tax buys a lot of surface you never open.' },
      { q: 'Why not a free single-network app?', a: 'They are great for one lane. The cost shows up when one idea has to become ten posts: retyping, re-previewing, re-counting characters, and remembering which draft went where.' },
      { q: 'Why not post by hand?', a: 'You can. Hand posting works until the week gets busy, and then the queue is the first thing to slip. A calendar you fill once beats five apps you remember at midnight.' },
      { q: 'What does Sosial not do?', a: 'Social listening, ad buying and inbox replacement. Those live in the suites. Sosial does compose, preview, schedule, approve and publish across ten networks, with an AI writer and analytics.' },
    ]),
  ];
}

function madeForEveryoneBlocks(): B[] {
  return [
    ...hero(
      'Publishing should not be a privilege.',
      'The tools behind daily posting got expensive, English-first and desktop-only. Sosial is the opposite: a free plan that stays free, a hundred languages, and the same app in your pocket as on your desk.',
    ),
    { t: 'h', c: 'One workspace, very different jobs.' },
    { t: 'h', c: 'Creators and founders' },
    { t: 'p', c: 'One person, ten channels, no team. Write in the morning, let the queue ship through the day, and keep the evening for actual work.' },
    { t: 'h', c: 'Small teams' },
    { t: 'p', c: 'A marketer, a writer and a founder who wants to approve things. Members draft, admins publish, owners hold the accounts and billing.' },
    { t: 'h', c: 'Agencies and freelancers' },
    { t: 'p', c: 'Many clients, clear edges. Keep each workspace separate, schedule across every network, and show up with analytics instead of excuses.' },
    { t: 'h', c: 'Languages — your language, first, not last.' },
    {
      t: 'p',
      c: 'The AI writer picks from 100+ languages before it drafts anything, so the output is native rather than translated. English, Melayu, Tamil, beyond: the composer and previews follow you.',
    },
    {
      t: 'ul',
      c: ['100+ languages chosen up front', 'No English-first awkwardness', 'Per-channel previews in your script'],
    },
    { t: 'h', c: 'Devices — phone, tablet, desk, equal.' },
    {
      t: 'p',
      c: 'iOS, Android and the web run the same workspace with the same queue behind them. Approve a post on the train; the worker still ships it on time with the laptop shut.',
    },
    {
      t: 'ul',
      c: ['Native apps on iOS and Android', 'Full workspace in the browser', 'Cloud queue publishes without any device open'],
    },
    { t: 'h', c: 'Access — built to be used.' },
    {
      t: 'p',
      c: 'Real contrast on every surface, keyboard paths through every flow, alt text treated as expected rather than optional, and no feature hidden behind a paywall that used to be free.',
    },
    {
      t: 'ul',
      c: ['Contrast checked on light and dark', 'Alt text prompts where the network expects them', 'A free plan with no expiry date'],
    },
    { t: 'h', c: 'Price — free means free.' },
    {
      t: 'p',
      c: 'Three channels, scheduled posts and 20 AI credits a month cost nothing, with no card and no trial clock. When you outgrow it, the paid prices are on a page you can read before signing up.',
    },
    ...faqBlocks([
      { q: 'Is the free plan a trial?', a: 'No. It has limits (3 channels, 10 scheduled posts per channel, 20 AI credits a month) and no end date. Credits reset on the 1st whether you upgrade or not.' },
    ]),
  ];
}

function transparencyBlocks(): B[] {
  return [
    ...hero(
      'Nothing important stays in the fine print.',
      'Prices you can read before signing up, data practices in plain sentences, AI that never trains on your drafts, and publish results reported per channel. If it affects your work, you can see it.',
    ),
    { t: 'h', c: 'Pricing — the price is on the page.' },
    {
      t: 'p',
      c: 'Free, Solo, Team and Business are listed with what each includes, before you create an account. No per-channel upsells, no seat taxes, and annual billing that simply knocks two months off. Changes to prices reach existing subscribers before they take effect.',
    },
    {
      t: 'ul',
      c: ['All plans and limits on one public page', 'No charge without a plan change you make', 'Cancel from settings, keep your data'],
    },
    { t: 'h', c: 'Your data — yours, not ours to sell.' },
    {
      t: 'p',
      c: 'We do not sell your content, your audience data or your schedule. Posts and drafts power your workspace and nothing else. Your briefs and drafts are not used to train AI models. Export or deletion requests are handled from support, in writing.',
    },
    {
      t: 'ul',
      c: ['No sale of content or audience data', 'No training on your drafts', 'Export and deletion on request'],
    },
    { t: 'h', c: 'AI — a drafter, never a publisher.' },
    {
      t: 'p',
      c: 'The AI writer researches, drafts and flags uncertainty with linked sources. It cannot schedule or publish anything. Every word passes through you first, and you always see what it used to ground a claim.',
    },
    {
      t: 'ul',
      c: ['Nothing publishes without your approval', 'Sources returned with researched drafts', 'Uncertainties flagged, not smoothed over'],
    },
    { t: 'h', c: 'Publishing — real limits, real results.' },
    {
      t: 'p',
      c: 'Character limits shown in the composer are the platforms actual limits, enforced before scheduling rather than after publishing. When the worker ships a post, each channel reports back its own result: sent, publishing or failed. Failures are visible, not quietly retried into the night.',
    },
    ...faqBlocks([
      { q: 'Do you train AI on what I write?', a: 'No. Briefs and drafts are not used to train models. Generated copy exists to serve your workspace and nothing else.' },
      { q: 'Who can see my scheduled posts?', a: 'People in your workspace, according to their role. Members see what they need to draft and review; connected accounts and billing stay with owners.' },
      { q: 'What happens when a platform changes a limit?', a: 'The limit updates in our channel data and the composer follows it. Every channel guide shows the number it is enforcing.' },
      { q: 'How do I get my data out?', a: 'Ask from support and you receive an export of your posts, schedule and workspace content. Deletion works the same way, in writing.' },
      { q: 'Will prices change without notice?', a: 'Existing subscribers get notice before a price change takes effect. The public pricing page always reflects what new customers pay today.' },
    ]),
  ];
}

function aboutBlocks(): B[] {
  return [
    ...hero(
      'One calendar for ten networks.',
      'Sosial exists because publishing daily across every network had become a second job: ten tabs, five drafts, and an alarm for the 11pm post. We are a small team building the workspace we wanted ourselves.',
    ),
    { t: 'h', c: 'Why — the job is the writing, not the routing.' },
    {
      t: 'p',
      c: 'Social work is ideas, hooks and edits. The routing, the character counts and the midnight scheduling are overhead. Sosial takes the overhead: one composer with honest previews, one calendar, and a queue that ships while you sleep.',
    },
    {
      t: 'ul',
      c: ['Compose once, publish to all ten channels', 'Approvals so nothing ships unreviewed', 'A worker that publishes on time, app closed'],
    },
    { t: 'h', c: 'How — small team, long horizon.' },
    {
      t: 'p',
      c: 'We ship in the open, publish our prices, and keep the free plan genuinely usable. No growth hacks in the composer, no selling your drafts, no dark patterns in billing. The product succeeds when daily posting stops feeling like a chore.',
    },
    {
      t: 'ul',
      c: ['Published pricing, plain-language policies', 'Free plan with no expiry clock', 'Features earn their place or they leave'],
    },
    { t: 'h', c: 'What is next — deeper where it counts.' },
    {
      t: 'p',
      c: 'More channels when the networks earn them, smarter drafting that stays under your approval, and analytics that answer what to write next instead of flooding you with charts. The calendar and queue stay the centre of gravity.',
    },
    { t: 'h', c: 'Principles — what we hold to.' },
    { t: 'h', c: 'Honest limits' },
    { t: 'p', c: 'The character count you see is the platform real limit, enforced before scheduling, not discovered after publishing.' },
    { t: 'h', c: 'Human approval' },
    { t: 'p', c: 'AI drafts, teammates review, you decide. Nothing reaches a network without a person pressing the button.' },
    { t: 'h', c: 'Fair access' },
    { t: 'p', c: 'A free plan without a trial date, 100+ languages from the first draft, and the same app on every device.' },
    ...faqBlocks([
      { q: 'What is Sosial, in one sentence?', a: 'One workspace where a team composes, approves and schedules posts for ten social networks, and a cloud queue publishes them on time.' },
      { q: 'Who is it built for?', a: 'Solo creators, in-house teams and agencies. Anyone whose week includes more than one network and more than zero deadlines.' },
      { q: 'Which channels are supported?', a: 'Instagram, TikTok, X, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon and Pinterest, each with its own guide and real limits.' },
      { q: 'How do I get in touch?', a: 'Support inside the app or on the login page reaches the team directly. Security and privacy matters are documented under Transparency and Privacy.' },
    ]),
  ];
}

/** Channel guides → prose blocks (facts table, tips, pitfalls, FAQs). */
function channelBlocks(key: string): B[] | null {
  const c = CHANNEL_GUIDES.find((g) => g.key === key);
  if (!c) return null;
  const out: B[] = [
    { t: 'h', c: `Sosial × ${c.name}` },
    { t: 'p', c: c.tagline },
    { t: 'p', c: c.intro },
    { t: 'h', c: 'Key facts' },
    {
      t: 'table',
      head: true,
      c: [['Fact', 'Detail'], ...c.facts.map((f) => [f.label, f.value])],
    },
    { t: 'h', c: 'Best for' },
    { t: 'ul', c: [...c.bestFor] },
    { t: 'h', c: `How to win on ${c.name}` },
    ...c.tips.flatMap((t) => [{ t: 'h', c: t.title } as B, { t: 'p', c: t.body } as B]),
    { t: 'h', c: 'Common mistakes' },
    { t: 'ul', c: [...c.pitfalls] },
    { t: 'h', c: `${c.name} on Sosial: FAQ` },
    ...faqBlocks(c.faqs),
  ];
  return out;
}

const STATIC_BLOCKS: Record<string, B[] | null> = {
  publish: publishBlocks(),
  pricing: pricingBlocks(),
  'ai-assistant': aiAssistantBlocks(),
  'features/create': featuresCreateBlocks(),
  compare: compareBlocks(),
  'made-for-everyone': madeForEveryoneBlocks(),
  transparency: transparencyBlocks(),
  about: aboutBlocks(),
};

function legalBlocks(doc: typeof TERMS | typeof PRIVACY): B[] {
  return [
    { t: 'p', c: doc.summary },
    ...doc.sections.flatMap((s) => [{ t: 'h', c: s.title } as B, ...s.blocks]),
  ];
}

/** The current live copy of a registered page, as editor-ready TipTap JSON. */
export function defaultDocForSlug(slug: string): TipTapDoc | null {
  if (slug.startsWith('resources/')) {
    const r = RESOURCES.find((x) => `resources/${x.slug}` === slug);
    return r ? legacyToTipTap(r.body) : null;
  }
  if (slug === 'terms') return legacyToTipTap(legalBlocks(TERMS));
  if (slug === 'privacy') return legacyToTipTap(legalBlocks(PRIVACY));
  if (slug.startsWith('integrations/')) {
    const b = channelBlocks(slug.split('/')[1]);
    return b ? legacyToTipTap(b) : null;
  }
  const b = STATIC_BLOCKS[slug];
  return b ? legacyToTipTap(b) : null;
}
