import type { Resource } from './types';

/**
 * The resources hub. Each entry is a self-contained working document — a
 * template you can copy, a checklist you can run through, or a reference you
 * can keep open — rather than a teaser for something else.
 */
export const RESOURCES: Resource[] = [
  {
    slug: 'content-calendar-template',
    title: 'The weekly content calendar template',
    description:
      'A four-format weekly grid you can fill in ten minutes — with the raw material each slot needs.',
    kind: 'Template',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'Most calendars fail because they ask for a new idea in every slot. This template asks for four formats you repeat every week, and a small list of raw material to fill them.',
      },
      { t: 'h', c: 'The weekly grid' },
      {
        t: 'ul',
        c: [
          'Monday — One lesson: something you learned or got wrong last week.',
          'Wednesday — One answer: a question a customer or reader actually asked.',
          'Friday — One proof: a result, a number, or a before-and-after.',
          'Optional — One opinion: your take on something happening in your field.',
        ],
      },
      { t: 'h', c: 'The raw material list' },
      {
        t: 'p',
        c: 'Keep a running note for each format. When someone asks you a good question, add it to the answers list. When something surprises you, add it to the lessons list. By the time you sit down to schedule, you are choosing, not inventing.',
      },
      { t: 'h', c: 'How to fill it' },
      {
        t: 'ul',
        c: [
          'Pick one item from the raw material list for each slot.',
          'Write the caption in the same sitting — do not wait for inspiration.',
          'Leave one slot empty each week for something timely.',
          'Schedule every post before you close the sheet.',
        ],
      },
      {
        t: 'p',
        c: 'In Sosial, put these straight into the queue rather than a template: three posts scheduled, one slot held open. The queue is the calendar.',
      },
    ],
  },
  {
    slug: 'caption-formulas-cheat-sheet',
    title: 'Caption formulas cheat sheet',
    description:
      'Seven reusable caption shapes with examples — for the days you have the idea but not the wording.',
    kind: 'Cheat sheet',
    minutes: 4,
    body: [
      {
        t: 'p',
        c: 'Print this, or keep it open while you write. Each formula is a shape you can pour a new idea into.',
      },
      { t: 'h', c: 'The seven shapes' },
      {
        t: 'ul',
        c: [
          'Result, reason, ask — "We cut churn 12%. It was one onboarding email. What fixed yours?"',
          'Mistake, cost, fix — "We lost a week to this. Here is the ten-minute fix."',
          'Before / after — show the change, then name the one thing that caused it.',
          'Contrarian — state the common advice, then the specific reason it fails.',
          'Numbered list — a count, a promise, then the items (only if they are genuinely distinct).',
          'Real question — two clear options, never "thoughts?".',
          'Moment / turn / lesson — a story in under 150 words.',
        ],
      },
      { t: 'h', c: 'How to pick' },
      {
        t: 'p',
        c: 'Match the shape to what you actually have. A number calls for result-reason-ask. A mistake calls for mistake-cost-fix. Forcing a list when you have a story is where captions go flat.',
      },
      { t: 'h', c: 'The rule above all of them' },
      {
        t: 'p',
        c: 'Put the most interesting sentence first. Every formula collapses if the opening line is setup rather than substance.',
      },
    ],
  },
  {
    slug: 'character-limit-cheat-sheet',
    title: 'Every channel limit in one place',
    description:
      'Caption, title and media limits for all ten channels Sosial publishes to — kept current.',
    kind: 'Cheat sheet',
    minutes: 3,
    body: [
      {
        t: 'p',
        c: 'The exact numbers the Sosial composer enforces, in one table you can check before you write.',
      },
      { t: 'h', c: 'Caption limits' },
      {
        t: 'ul',
        c: [
          'X — 280 characters per post.',
          'Bluesky — 300 characters.',
          'Threads — 500 characters.',
          'Mastodon — 500 characters (some servers raise this).',
          'Pinterest — 500 characters, plus a 100-character title.',
          'Instagram — 2,200 characters, up to 20 carousel items.',
          'TikTok — 2,200 characters.',
          'LinkedIn — 3,000 characters.',
          'YouTube — 5,000-character description, 100-character title.',
          'Facebook — 63,206 characters.',
        ],
      },
      { t: 'h', c: 'Media rules worth knowing' },
      {
        t: 'ul',
        c: [
          'X — up to 4 images or 1 video per post.',
          'Instagram — 1080×1350 for feed, 1080×1920 for Reels.',
          'TikTok — 9:16 at 1080×1920, ideally under 60 seconds.',
          'Pinterest — 2:3 vertical at 1000×1500.',
          'YouTube Shorts — vertical, up to 3 minutes.',
        ],
      },
      {
        t: 'p',
        c: 'Sosial applies the right limit per channel automatically and warns you before you schedule, so you never publish a truncated caption by accident.',
      },
    ],
  },
  {
    slug: 'content-repurposing-playbook',
    title: 'The content repurposing playbook',
    description:
      'Turn one article into a month of posts with a repeatable extraction method.',
    kind: 'Playbook',
    minutes: 7,
    body: [
      {
        t: 'p',
        c: 'Repurposing only works when you extract the individual units of value a piece already contains and give each one the right shape — not when you copy a paragraph and post it.',
      },
      { t: 'h', c: 'Step 1 — Mine the source' },
      {
        t: 'p',
        c: 'Take your article, video or podcast episode and list every unit inside it: each heading, each number, each list, each mistake, each example. A 1,500-word article typically yields twenty units.',
      },
      { t: 'h', c: 'Step 2 — Assign a format' },
      {
        t: 'ul',
        c: [
          'Headings become standalone tip posts.',
          'Numbers become single-image stat posts.',
          'Lists become carousels or threads.',
          'Mistakes become "stop doing this" posts.',
          'Examples become mini case studies.',
        ],
      },
      { t: 'h', c: 'Step 3 — Spread it over six to eight weeks' },
      {
        t: 'p',
        c: 'Do not dump the whole set in one week. Spacing keeps the source earning and prevents your feed reading as a single-topic broadcast.',
      },
      { t: 'h', c: 'Step 4 — Route it through the queue' },
      {
        t: 'p',
        c: 'Schedule the units into the queue as you produce them. The article publishes once; the posts keep arriving.',
      },
    ],
  },
  {
    slug: 'social-media-audit-checklist',
    title: 'The 30-minute social media audit',
    description:
      'A once-a-quarter checklist that catches the problems that quietly cost reach.',
    kind: 'Guide',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'An audit is not a metrics review. It is a check that the mechanics behind your accounts are still sound. Thirty minutes, once a quarter.',
      },
      { t: 'h', c: 'Accounts and access' },
      {
        t: 'ul',
        c: [
          'Every connected channel still shows as connected — no expired tokens.',
          'Everyone with access still needs it. Remove people who have left.',
          'At least two people can access billing in case one is unavailable.',
        ],
      },
      { t: 'h', c: 'Content health' },
      {
        t: 'ul',
        c: [
          'The queue never drops below three scheduled posts.',
          'No single niche has dominated the last month.',
          'Your top three and bottom three posts are a comparison worth making — write one sentence on what separated them.',
        ],
      },
      { t: 'h', c: 'The mechanics' },
      {
        t: 'ul',
        c: [
          'Publishing failures in the last quarter were token refreshes, not format rejections — investigate any rejection that repeats.',
          'Bio, links and pinned posts are still accurate.',
          'Times still match when your audience is actually awake.',
        ],
      },
      {
        t: 'p',
        c: 'Fix what is broken, write the one sentence about content, and close the document until next quarter.',
      },
    ],
  },
  {
    slug: 'launch-day-social-playbook',
    title: 'The launch day social playbook',
    description:
      'A countdown sequence for announcing something — without posting the same thing five times.',
    kind: 'Playbook',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Launches go wrong when every channel gets the same announcement on the same day. The sequence below gives each moment something different to say.',
      },
      { t: 'h', c: 'T-minus seven days — the problem' },
      {
        t: 'p',
        c: 'Post about the problem your launch solves, with no mention of the launch. This earns attention before you ask for it.',
      },
      { t: 'h', c: 'T-minus three days — the build-up' },
      {
        t: 'p',
        c: 'Show something specific: a screenshot, a clip, a detail nobody has seen. Resist announcing; let curiosity build.',
      },
      { t: 'h', c: 'Launch day — the announcement' },
      {
        t: 'ul',
        c: [
          'Lead with the outcome, not the feature list.',
          'Put the link where each channel expects it — in the first comment on LinkedIn, inline on X and Threads.',
          'Adapt the length per channel; the same paragraph does not fit a 280-character post and a LinkedIn update.',
        ],
      },
      { t: 'h', c: 'T-plus two days — the proof' },
      {
        t: 'p',
        c: 'Share an early reaction, a first result, or a question someone asked. Proof posts consistently outperform the announcement itself.',
      },
      {
        t: 'p',
        c: 'Schedule the whole sequence in advance in Sosial, then spend launch day replying rather than typing.',
      },
    ],
  },
  {
    slug: 'social-media-glossary',
    title: 'Social media glossary',
    description:
      'Plain-English definitions for the terms that get used loosely — from reach to repurposing.',
    kind: 'Glossary',
    minutes: 5,
    body: [
      { t: 'h', c: 'Reach and impressions' },
      {
        t: 'p',
        c: 'Reach is the number of unique accounts that saw a post. Impressions counts every time it was displayed, including repeats. A rising impression count with flat reach just means the same people are seeing it more.',
      },
      { t: 'h', c: 'Engagement rate' },
      {
        t: 'p',
        c: 'Engagements divided by reach. Measuring against reach tells you how compelling the post was; measuring against followers tells you how well it travelled. Use reach-based numbers for content decisions.',
      },
      { t: 'h', c: 'Queue' },
      {
        t: 'p',
        c: 'The list of approved posts waiting for their scheduled time. A healthy queue means posting no longer depends on doing something today.',
      },
      { t: 'h', c: 'Evergreen content' },
      {
        t: 'p',
        c: 'Content that stays true and useful over time — explanations, frameworks, how-tos. Evergreen posts can be rescheduled and recycled, unlike timely commentary.',
      },
      { t: 'h', c: 'Repurposing' },
      {
        t: 'p',
        c: 'Extracting the individual units of value from one piece — headings, numbers, examples — and giving each its own format and channel. Distinct from cross-posting, which is the same post sent to more places.',
      },
      { t: 'h', c: 'ALT text' },
      {
        t: 'p',
        c: 'A written description of an image for people who cannot see it. Expected on Bluesky and Mastodon in particular, and it adds searchable context everywhere.',
      },
    ],
  },
  {
    slug: 'social-media-manager-onboarding',
    title: 'Onboarding a social media manager',
    description:
      'A first-week plan that gets a new hire from observing to publishing safely.',
    kind: 'Guide',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'The riskiest moment in hiring a social media manager is the first week, when they have access but not context. This plan sequences access deliberately.',
      },
      { t: 'h', c: 'Day one — read, do not post' },
      {
        t: 'ul',
        c: [
          'Read the last 90 days of posts on each channel.',
          'Read the comments, not just the posts.',
          'Write down the three questions you would ask the audience.',
        ],
      },
      { t: 'h', c: 'Day two and three — draft, do not publish' },
      {
        t: 'p',
        c: 'Give the new manager member access: they can draft and submit for review, but cannot publish or touch connected accounts. Have them draft a week of content and compare it with what you would have written.',
      },
      { t: 'h', c: 'Day four and five — approve together' },
      {
        t: 'p',
        c: 'Review their drafts line by line. Approve some, send others back with a note. The notes are the onboarding — a written record of your standards.',
      },
      { t: 'h', c: 'Week two — promote to publishing' },
      {
        t: 'p',
        c: 'Once drafts are consistently close, promote them to admin. They can now schedule to the channels they own, while connected accounts and billing stay with the owner.',
      },
      {
        t: 'p',
        c: 'Sosial supports exactly this shape: members draft, admins approve and publish, owners hold the accounts.',
      },
    ],
  },
];

export function allResources(): Resource[] {
  return RESOURCES;
}

export function resource(slug: string): Resource | undefined {
  return RESOURCES.find((r) => r.slug === slug);
}
