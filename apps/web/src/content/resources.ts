import type { Resource } from './types';

/**
 * The resources hub. Each entry is a self-contained working document — a
 * template you can copy, a checklist you can run through, or a reference you
 * can keep open — rather than a teaser for something else.
 */
export const RESOURCES: Resource[] = [
  {
    slug: 'launch-day-social-playbook',
    title: 'The launch day social playbook',
    description:
      'A countdown sequence for announcing something, without posting the same thing five times.',
    kind: 'Playbook',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Launches go wrong when every channel gets the same announcement on the same day. The sequence below gives each moment something different to say.',
      },
      { t: 'h', c: 'T-minus seven days: the problem' },
      {
        t: 'p',
        c: 'Post about the problem your launch solves, with no mention of the launch. This earns attention before you ask for it.',
      },
      { t: 'h', c: 'T-minus three days: the build-up' },
      {
        t: 'p',
        c: 'Show something specific: a screenshot, a clip, a detail nobody has seen. Resist announcing; let curiosity build.',
      },
      { t: 'h', c: 'Launch day: the announcement' },
      {
        t: 'ul',
        c: [
          'Lead with the outcome, not the feature list.',
          'Put the link where each channel expects it: in the first comment on LinkedIn, inline on X and Threads.',
          'Adapt the length per channel; the same paragraph does not fit a 280-character post and a LinkedIn update.',
        ],
      },
      { t: 'h', c: 'T-plus two days: the proof' },
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
      'Plain-English definitions for the terms that get used loosely, from reach to repurposing.',
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
        c: 'Content that stays true and useful over time: explanations, frameworks, how-tos. Evergreen posts can be rescheduled and recycled, unlike timely commentary.',
      },
      { t: 'h', c: 'Repurposing' },
      {
        t: 'p',
        c: 'Extracting the individual units of value from one piece: headings, numbers, examples, and giving each its own format and channel. Distinct from cross-posting, which is the same post sent to more places.',
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
      { t: 'h', c: 'Day one: read, do not post' },
      {
        t: 'ul',
        c: [
          'Read the last 90 days of posts on each channel.',
          'Read the comments, not just the posts.',
          'Write down the three questions you would ask the audience.',
        ],
      },
      { t: 'h', c: 'Day two and three: draft, do not publish' },
      {
        t: 'p',
        c: 'Give the new manager member access: they can draft and submit for review, but cannot publish or touch connected accounts. Have them draft a week of content and compare it with what you would have written.',
      },
      { t: 'h', c: 'Day four and five: approve together' },
      {
        t: 'p',
        c: 'Review their drafts line by line. Approve some, send others back with a note. The notes are the onboarding, a written record of your standards.',
      },
      { t: 'h', c: 'Week two: promote to publishing' },
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
