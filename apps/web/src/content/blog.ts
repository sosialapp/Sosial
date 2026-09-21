import type { Article } from './types';

/**
 * The Sosial blog. Written to be genuinely useful on its own — specific
 * numbers, real platform limits, no filler. Sorted newest-first by `byDate`.
 */
export const ARTICLES: Article[] = [
  {
    slug: 'best-time-to-post-on-social-media',
    title: 'The best time to post on social media (and why the answer is boring)',
    description:
      'Timing tests are mostly noise. Here is what actually moves reach, and how to find your own best windows in about ten minutes.',
    date: '2026-09-14',
    tag: 'Strategy',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Every "best time to post" chart you have read is an average of accounts that are not yours. An average of millions of accounts with different audiences, timezones and topics tells you almost nothing about when your specific readers are scrolling.',
      },
      { t: 'h', c: 'What timing actually controls' },
      {
        t: 'p',
        c: 'Timing does not decide whether a good post succeeds. It decides who is awake when the post first enters the feed — and the first hour is when most platforms decide how far to push it.',
      },
      {
        t: 'ul',
        c: [
          'Post when your audience is awake, not when a global chart says so.',
          'Post consistently enough that your first hour is predictable.',
          'Post when you can respond to replies. Early comments compound reach.',
        ],
      },
      { t: 'h', c: 'Find your own windows in ten minutes' },
      {
        t: 'p',
        c: 'Open the analytics of your best-performing posts from the last 90 days. Note the hour each was published. Group them: morning, lunch, evening. The cluster with the highest median engagement is your window — not the highest single post, the highest median.',
      },
      {
        t: 'p',
        c: 'Then test one change at a time. Move your whole schedule forward two hours for two weeks. If median engagement rises, keep it. If it does not, revert. Two-week blocks, one variable.',
      },
      { t: 'h', c: 'The uncomfortable part' },
      {
        t: 'p',
        c: 'Most accounts do not have a timing problem. They have a consistency problem. An account posting twice a week at a suboptimal hour will beat one posting twice a month at a perfect hour, every time.',
      },
      {
        t: 'p',
        c: 'Once you accept that, the win is scheduling a realistic volume you can sustain. Two posts a week, every week, at roughly the same times, is a strategy. Eight posts in one weekend followed by silence is not.',
      },
    ],
  },
  {
    slug: 'social-media-content-calendar-guide',
    title: 'How to build a content calendar you will actually keep',
    description:
      'A calendar fails when it demands more ideas than you have. Build one around repeatable formats instead.',
    date: '2026-09-09',
    tag: 'Strategy',
    minutes: 7,
    body: [
      {
        t: 'p',
        c: 'Most content calendars die in week three. Not because the person building them was lazy, but because the calendar assumed a fresh idea for every slot. Ideas are the scarce resource; formats are not.',
      },
      { t: 'h', c: 'Start with formats, not topics' },
      {
        t: 'p',
        c: 'A format is a repeatable shape. Once you have four, you can fill a month without inventing anything:',
      },
      {
        t: 'ul',
        c: [
          'One lesson from this week — a specific thing you learned or got wrong.',
          'One answer — a question a customer or reader actually asked.',
          'One opinion — a take on something happening in your field.',
          'One proof — a result, a number, a before-and-after.',
        ],
      },
      {
        t: 'p',
        c: 'Four formats, three posts a week, twelve slots a month. You need twelve pieces of raw material, not twelve ideas.',
      },
      { t: 'h', c: 'Give every slot a job' },
      {
        t: 'p',
        c: 'A calendar where every post tries to sell will fatigue your audience. Assign each week a balance: two posts that give something away, one that asks for something.',
      },
      { t: 'h', c: 'Leave a quarter of the month empty' },
      {
        t: 'p',
        c: 'Fill 75% of your slots in advance and keep the rest for timely things — a launch, a news moment, a reply that deserves its own post. A completely full calendar cannot react.',
      },
      { t: 'h', c: 'Then get it out of your head' },
      {
        t: 'p',
        c: 'The point of a calendar is to make posting not require a decision. Put every slot in the queue, pick times, and let the schedule run. Move things when you need to; do not rebuild from scratch.',
      },
    ],
  },
  {
    slug: 'how-to-schedule-instagram-posts',
    title: 'How to schedule Instagram posts, Reels and carousels',
    description:
      'A step-by-step walkthrough, plus the format mistakes that quietly cost you reach.',
    date: '2026-09-04',
    tag: 'Publishing',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'Scheduling Instagram is straightforward once you know which formats the API accepts and how the caption is cropped. Here is the whole process.',
      },
      { t: 'h', c: 'Requirements first' },
      {
        t: 'ul',
        c: [
          'A connected Instagram business or creator account linked to a Facebook Page.',
          'Images at 1080×1350 for feed, 1080×1920 for Reels.',
          'Caption up to 2,200 characters; carousels can hold up to 20 items.',
        ],
      },
      { t: 'h', c: 'The steps' },
      {
        t: 'ul',
        c: [
          'Write the caption. Front-load the hook — roughly the first 125 characters show before "more".',
          'Attach media in the order you want a carousel to read.',
          'Pick the time in your audience\'s timezone.',
          'Choose draft, schedule, or publish now.',
        ],
      },
      { t: 'h', c: 'The mistakes that cost reach' },
      {
        t: 'p',
        c: 'The most common one is reusing a 16:9 upload. Instagram letterboxes it, which wastes vertical space and reads as recycled. The second is posting an X-length caption to Instagram, where the audience expects a little more.',
      },
      { t: 'h', c: 'Carousels are the underused format' },
      {
        t: 'p',
        c: 'A carousel keeps people in the post longer than a single image because each swipe is a fresh impression. Turn each section of an article into a slide and the closing slide into a soft call to action. One article becomes a week of posts.',
      },
    ],
  },
  {
    slug: 'how-to-schedule-tiktok-videos',
    title: 'How to schedule TikTok videos without losing the native feel',
    description:
      'Upload settings, caption limits and the production habits that make scheduled posts still feel handmade.',
    date: '2026-08-30',
    tag: 'Publishing',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'TikTok is unforgiving about polish but rewards consistency. Scheduling is the right tool for the consistency half — as long as the videos themselves still feel native.',
      },
      { t: 'h', c: 'Upload settings that matter' },
      {
        t: 'ul',
        c: [
          '9:16 at 1080×1920 — the only ratio that fills the screen.',
          'MP4, ideally under 60 seconds and under 100 MB.',
          'A caption up to 2,200 characters, though the first 100 do the work.',
        ],
      },
      { t: 'h', c: 'Keep the native feel' },
      {
        t: 'p',
        c: 'Do not re-upload a video with another platform\'s watermark; the algorithm down-ranks obvious reposts and viewers recognise them instantly. Re-export instead, and cut a different first second.',
      },
      {
        t: 'p',
        c: 'Burn captions into the video. Most viewers start muted, and a clip that needs sound to make sense loses them before the hook lands.',
      },
      { t: 'h', c: 'Series beat one-offs' },
      {
        t: 'p',
        c: 'A recurring format — same opening line, same structure, new topic — builds a reason to follow. Schedule three a week on one theme rather than chasing a single viral attempt.',
      },
    ],
  },
  {
    slug: 'how-to-schedule-x-threads',
    title: 'How to write and schedule an X thread that holds attention',
    description:
      'Thread-writing rules that survive the 280-character limit, and where to place the links.',
    date: '2026-08-25',
    tag: 'Publishing',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'A thread is not a blog post cut into pieces. It is an argument delivered one step at a time, where each step has to be worth reading on its own.',
      },
      { t: 'h', c: 'Rules for the thread' },
      {
        t: 'ul',
        c: [
          'One idea per post. If a post needs the next one to make sense, it is too long.',
          'No throat-clearing. Delete "a thread", "let me explain" and every warm-up sentence.',
          'Keep each post under 280 characters with room for the point to land.',
          'The final post resolves the thread. Do not trail off.',
        ],
      },
      { t: 'h', c: 'Where links go' },
      {
        t: 'p',
        c: 'X no longer counts a link\'s card against the character limit, but a post that exists only to carry a link rarely performs. If the link is the point, make the surrounding posts valuable anyway.',
      },
      { t: 'h', c: 'Scheduling a thread' },
      {
        t: 'p',
        c: 'Write the thread as separate numbered posts in the composer, then schedule the whole chain. Sosial publishes them in order. If a post exceeds 280 characters, the counter warns you before you schedule rather than letting an automatic split land somewhere ugly.',
      },
      { t: 'h', c: 'Reuse the thread' },
      {
        t: 'p',
        c: 'The same thread structure works on Threads, Bluesky and Mastodon. Adjust the tone and the length, then schedule all four from one session.',
      },
    ],
  },
  {
    slug: 'cross-posting-without-sounding-generic',
    title: 'How to cross-post without sounding generic',
    description:
      'The same idea should not read identically on X, LinkedIn and Instagram. Here is how to adapt in minutes, not hours.',
    date: '2026-08-20',
    tag: 'Strategy',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Cross-posting gets a bad reputation because most people do it lazily: one caption pasted everywhere. The fix is not writing five separate posts from scratch — it is changing three things per channel.',
      },
      { t: 'h', c: 'Change the opener, the length and the ask' },
      {
        t: 'ul',
        c: [
          'The opener: X wants the claim first; LinkedIn wants the specific result; Instagram wants the visual hook.',
          'The length: 280 characters on X, 150–300 words on LinkedIn, a short caption under a strong image on Instagram.',
          'The ask: a reply on X, a share on LinkedIn, a save or a comment on Instagram.',
        ],
      },
      {
        t: 'p',
        c: 'Three edits. The idea is identical, the post does not read as recycled.',
      },
      { t: 'h', c: 'A worked example' },
      {
        t: 'p',
        c: 'Say the idea is "we cut onboarding from 14 days to 3". On X: the number and the one-line reason. On LinkedIn: the number, the three things you changed, and a question about their process. On Instagram: a before-and-after graphic with the number on it and a short caption.',
      },
      { t: 'h', c: 'Let the tool adapt, keep the judgement' },
      {
        t: 'p',
        c: 'Sosial applies the right character limit per channel and flags when a caption is too long, so you make the cut deliberately. The judgement about tone stays with you — and it should.',
      },
    ],
  },
  {
    slug: 'repurpose-one-blog-post-into-30-posts',
    title: 'How to turn one blog post into 30 social posts',
    description:
      'A systematic repurposing method that produces a month of content from a single article.',
    date: '2026-08-15',
    tag: 'Growth',
    minutes: 7,
    body: [
      {
        t: 'p',
        c: 'Repurposing fails when it means "copy a paragraph and post it". It works when you extract the individual units of value an article already contains and give each one a shape.',
      },
      { t: 'h', c: 'Mine the article for units' },
      {
        t: 'ul',
        c: [
          'Every heading is a standalone tip post.',
          'Every number is a stat post.',
          'Every list is a carousel or a thread.',
          'Every mistake you mention is a "stop doing this" post.',
          'Every example is a mini case study.',
        ],
      },
      {
        t: 'p',
        c: 'A 1,500-word article with six headings, four numbers and two examples yields roughly twenty usable units. Add a few quotes pulled from the piece and you are at thirty.',
      },
      { t: 'h', c: 'Give each unit the right format' },
      {
        t: 'p',
        c: 'Stats become single-image posts. Lists become carousels. Arguments become threads. Quotes become text posts. The format should follow the shape of the idea, not your schedule.',
      },
      { t: 'h', c: 'Spread it, do not dump it' },
      {
        t: 'p',
        c: 'Publish the thirty units over six to eight weeks rather than one week. Then the article keeps earning long after launch, and your feed never reads as a single-topic broadcast.',
      },
    ],
  },
  {
    slug: 'caption-formulas-that-work',
    title: 'Seven caption formulas that work on almost any channel',
    description:
      'Reusable shapes for captions — with examples — for when the blank page wins.',
    date: '2026-08-10',
    tag: 'Growth',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Formulas are not a substitute for thinking. They are what you reach for on the days you have the idea but not the framing.',
      },
      { t: 'h', c: 'The seven' },
      {
        t: 'ul',
        c: [
          'Result, reason, ask — "We cut churn 12%. It was one onboarding email. What fixed yours?"',
          'Mistake, cost, fix — "We lost a week to this. Here is the ten-minute fix."',
          'Before and after — show the change, then the one thing that caused it.',
          'Contrarian — the common advice, then the specific reason it fails.',
          'List — a number, a promise, then the items. Only when the items are genuinely distinct.',
          'Question — a real question with two clear options, never "thoughts?".',
          'Story — a moment, a turn, a lesson. Keep it under 150 words.',
        ],
      },
      { t: 'h', c: 'How to choose' },
      {
        t: 'p',
        c: 'Match the formula to what you actually have. If you have a number, use result-reason-ask. If you have a mistake, use mistake-cost-fix. Forcing a list when you have a story is where captions go wrong.',
      },
      { t: 'h', c: 'One rule over all of them' },
      {
        t: 'p',
        c: 'Put the most interesting sentence first. Every formula above collapses if the opening line is setup instead of substance.',
      },
    ],
  },
  {
    slug: 'hashtag-strategy-that-still-works',
    title: 'A hashtag strategy that still works in 2026',
    description:
      'Hashtags are not dead, but they are not a growth lever either. Here is what they are actually for now.',
    date: '2026-08-05',
    tag: 'Growth',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'Hashtags once felt like a cheat code. Today they are closer to a labelling system: useful for categorising and for a small amount of discovery, not a way to manufacture reach.',
      },
      { t: 'h', c: 'What changed' },
      {
        t: 'ul',
        c: [
          'Recommendation feeds now weigh watch time and saves far above tags.',
          'Generic tags are saturated beyond usefulness — #marketing is millions of posts deep.',
          'Platform cultures diverged: Instagram tolerates a handful, Threads ignores them, Mastodon rewards them.',
        ],
      },
      { t: 'h', c: 'What to do instead' },
      {
        t: 'p',
        c: 'Use three to five specific tags that describe the content precisely — think #smallbusinessbookkeeping, not #business. Add one community tag if you have one. Then stop, and spend the effort on the first line of the caption instead.',
      },
      { t: 'h', c: 'Per channel' },
      {
        t: 'ul',
        c: [
          'Instagram: 3–8 specific tags. Thirty generic ones read as spam.',
          'X: 0–2. They mostly add noise.',
          'LinkedIn: up to 3.',
          'Mastodon: 2–3 well-chosen tags genuinely help discovery.',
          'Threads and Bluesky: skip them.',
        ],
      },
    ],
  },
  {
    slug: 'ai-writing-that-sounds-like-you',
    title: 'How to use AI writing without sounding like a robot',
    description:
      'AI drafts are a starting point, not a personality. The habits that keep your voice intact.',
    date: '2026-07-30',
    tag: 'AI',
    minutes: 7,
    body: [
      {
        t: 'p',
        c: 'The tell of AI writing is not the vocabulary. It is the evenness — every paragraph the same weight, every claim hedged, nothing specific enough to argue with.',
      },
      { t: 'h', c: 'Give it your rough thought, not a blank brief' },
      {
        t: 'p',
        c: 'The higher the quality of your input, the less generic the output. "Write a post about productivity" produces mush. "I stopped using to-do lists because I kept rewriting them; now I write three things on a sticky note" produces something with a shape.',
      },
      { t: 'h', c: 'Three edits that fix almost anything' },
      {
        t: 'ul',
        c: [
          'Delete the first sentence. It is usually a warm-up the model added for safety.',
          'Replace one abstract noun with a number or a name.',
          'Cut the summary paragraph at the end. Real posts do not recap themselves.',
        ],
      },
      { t: 'h', c: 'Feed it your own words' },
      {
        t: 'p',
        c: 'Sosial ships style samples — real examples of a style, not just a label — so the draft starts closer to your voice. Pair that with a language setting and the draft arrives in the language your audience actually reads.',
      },
      { t: 'h', c: 'You still own the last 10%' },
      {
        t: 'p',
        c: 'Let the model handle structure and the first pass. Keep the specific detail, the opinion, and the ending — those are the parts that make a post unmistakably yours.',
      },
    ],
  },
  {
    slug: 'ai-prompts-for-social-post-ideas',
    title: 'AI prompts that produce usable post ideas',
    description:
      'Prompts that generate ideas you can actually publish, instead of fifteen variations of "share a tip".',
    date: '2026-07-24',
    tag: 'AI',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Most idea prompts fail because they ask for ideas without giving the model anything to work from. A model with no material produces the average of everything it has read.',
      },
      { t: 'h', c: 'The structure that works' },
      {
        t: 'p',
        c: 'Give it four things: who you are, who you are talking to, what actually happened recently, and what shape the output should take.',
      },
      {
        t: 'ul',
        c: [
          'Who: "I run a two-person bookkeeping studio."',
          'Audience: "Sole traders who dread tax season."',
          'Material: "Three clients asked the same question about receipts this month."',
          'Shape: "Ten post ideas, each one sentence, no hashtags."',
        ],
      },
      { t: 'h', c: 'Then push for specificity' },
      {
        t: 'p',
        c: 'Ask a follow-up: "rewrite these so each mentions a concrete number, tool or deadline." Generic ideas survive this prompt badly, which is exactly the point — you want them to fail so you can drop them.',
      },
      { t: 'h', c: 'Keep the misses' },
      {
        t: 'p',
        c: 'Save the ideas you reject. A prompt that produces two good ideas out of ten is a good prompt if you keep the other eight for later.',
      },
    ],
  },
  {
    slug: 'using-ai-to-write-threads',
    title: 'Using AI to draft threads (without the tell-tale structure)',
    description:
      'Threads are where AI drafts get exposed fastest. How to keep the logic and lose the sameness.',
    date: '2026-07-18',
    tag: 'AI',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'A thread makes structure visible. Fifteen posts with identical rhythm and each one starting with a transition word reads as generated within two scrolls.',
      },
      { t: 'h', c: 'Ask for the argument, not the thread' },
      {
        t: 'p',
        c: 'Prompt for the logic — "give me the five steps in order, one line each" — then write the posts yourself from the outline. You keep the thinking and supply the voice.',
      },
      { t: 'h', c: 'Break the rhythm on purpose' },
      {
        t: 'ul',
        c: [
          'Vary post length between two words and two sentences.',
          'Do not open every post with a transition.',
          'Let one post be just a number or a one-line claim.',
          'Keep the strongest sentence for the second post, not the first.',
        ],
      },
      { t: 'h', c: 'Demand the count you asked for' },
      {
        t: 'p',
        c: 'Drafting tools routinely collapse a seven-post thread into five. Sosial asks for the exact post count and warns you if a thread comes back shorter than requested, so you notice the collapse before scheduling rather than after publishing.',
      },
    ],
  },
  {
    slug: 'posting-in-multiple-languages',
    title: 'Posting in multiple languages without doubling your workload',
    description:
      'How to reach a bilingual or multilingual audience without writing every post twice.',
    date: '2026-07-12',
    tag: 'Growth',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'For a lot of businesses, the audience is genuinely bilingual. The usual answer — write everything twice — doubles the work and usually means one language gets neglected within a month.',
      },
      { t: 'h', c: 'Pick a primary and adapt the big ones' },
      {
        t: 'p',
        c: 'Not every post deserves two languages. Translate the ones that carry your positioning: launches, offers, cornerstone explanations. Let the quick replies and observations live in the language they were written in.',
      },
      { t: 'h', c: 'Translate meaning, not words' },
      {
        t: 'p',
        c: 'Literal translation reads as a translation. Idioms, humour and even punctuation differ. If you translate word for word, the result is grammatically correct and socially off.',
      },
      { t: 'h', c: 'Schedule both, offset' },
      {
        t: 'p',
        c: 'Publishing both languages at the same moment splits your own reach across two posts competing for the same hour. Offset them by a day. Sosial supports 100+ languages and keeps each post\'s character limit correct for its channel.',
      },
    ],
  },
  {
    slug: 'social-media-approval-workflow',
    title: 'How to set up a social media approval workflow',
    description:
      'A simple review process that stops rogue posts without turning you into a bottleneck.',
    date: '2026-07-06',
    tag: 'Teams',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Approvals go wrong in one of two directions: nobody checks anything, or every post sits in a queue waiting for one overloaded person. Both are avoidable.',
      },
      { t: 'h', c: 'Decide what actually needs review' },
      {
        t: 'ul',
        c: [
          'Needs review: offers, pricing, anything legal or partner-related, anything from a new team member.',
          'Does not: replies, resharing, scheduled evergreen content that has run before.',
        ],
      },
      {
        t: 'p',
        c: 'Reviewing everything trains people to rubber-stamp, which is worse than not reviewing at all.',
      },
      { t: 'h', c: 'Make review one screen' },
      {
        t: 'p',
        c: 'The reviewer should see the caption, the media and the channels together and be able to approve or send it back with a note. If reviewing takes more than a minute per post, it will not happen consistently.',
      },
      { t: 'h', c: 'In Sosial' },
      {
        t: 'p',
        c: 'Team members draft instead of publishing. Their post moves to Needs approval with an explicit note. An owner or admin opens the queue, approves in one tap, or requests changes with a comment — which returns the post to drafts with the note attached.',
      },
    ],
  },
  {
    slug: 'social-media-roles-and-permissions',
    title: 'Social media roles and permissions, explained',
    description:
      'Owner, admin and member — who should be able to publish, approve, and connect accounts.',
    date: '2026-06-29',
    tag: 'Teams',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'Giving everyone admin access is the fastest way to lose an account. The right split is small: most people draft, a few approve, fewer still should touch connected accounts.',
      },
      { t: 'h', c: 'A three-role model' },
      {
        t: 'ul',
        c: [
          'Owner — billing, workspace deletion, everything. Keep this to one or two people.',
          'Admin — can approve, schedule, manage channels and invite or remove members.',
          'Member — can draft and submit for approval, cannot publish or change connected accounts.',
        ],
      },
      { t: 'h', c: 'Connect accounts last' },
      {
        t: 'p',
        c: 'Connecting a channel grants the ability to post to it. That permission belongs with owners and admins, not with everyone who writes.',
      },
      { t: 'h', c: 'Member restrictions' },
      {
        t: 'p',
        c: 'A member can also be limited to specific channels — useful for a social manager who runs Instagram only, or a specialist who handles one client brand. Their drafts can only target the channels you assigned.',
      },
      { t: 'h', c: 'Review access quarterly' },
      {
        t: 'p',
        c: 'People change roles and leave. A five-minute look at the roster every quarter prevents the most common access incident.',
      },
    ],
  },
  {
    slug: 'client-approvals-for-agencies',
    title: 'Client approvals for agencies, without the email chains',
    description:
      'A cleaner way to get client sign-off on a month of content.',
    date: '2026-06-22',
    tag: 'Teams',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Agency approvals die in inboxes. The post is in one email, the feedback in a reply, the media in a shared drive, and nobody is sure which version was approved.',
      },
      { t: 'h', c: 'One source of truth per post' },
      {
        t: 'p',
        c: 'Every post should have exactly one canonical version: caption, media, target channels, scheduled time. If a client comments by email, the change has to land in that version or it did not happen.',
      },
      { t: 'h', c: 'Batch the review' },
      {
        t: 'p',
        c: 'Instead of sending posts one at a time, schedule a month and send one review window. Clients give better, more coherent feedback when they can see the calendar as a whole.',
      },
      { t: 'h', c: 'Make "request changes" a first-class action' },
      {
        t: 'p',
        c: 'Approval and rejection are not the only outcomes. A "request changes with a comment" action — which moves the post back to drafts with the note attached — keeps the feedback next to the work.',
      },
      { t: 'h', c: 'Give the client less access, not more' },
      {
        t: 'p',
        c: 'A client with approval-only access can review and comment without risking the connected accounts. That is usually the whole of what they want.',
      },
    ],
  },
  {
    slug: 'content-calendar-for-small-teams',
    title: 'A content calendar that works for a team of two',
    description:
      'Roles, handoffs and a weekly rhythm for small teams who cannot afford a content department.',
    date: '2026-06-15',
    tag: 'Teams',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Small teams do not need a content process, they need a rhythm. One hour a week beats a workflow diagram nobody follows.',
      },
      { t: 'h', c: 'Split the roles honestly' },
      {
        t: 'ul',
        c: [
          'One person owns ideas and drafting.',
          'One person owns approval and publishing.',
          'Both own the numbers once a month.',
        ],
      },
      {
        t: 'p',
        c: 'With two people, those hats must be separate or nothing gets a second opinion. With one person, the approval step becomes a 24-hour rule: draft today, publish tomorrow.',
      },
      { t: 'h', c: 'A weekly rhythm' },
      {
        t: 'ul',
        c: [
          'Monday, 30 minutes — pick the week\'s three posts from the backlog.',
          'Wednesday, 20 minutes — draft and put them in the queue.',
          'Friday, 10 minutes — approve, confirm times, note anything that worked.',
        ],
      },
      { t: 'h', c: 'Keep a backlog, not a calendar' },
      {
        t: 'p',
        c: 'Ideas arrive at inconvenient times. A running list of raw ideas — a note, a voice memo, a drafts column — means the Monday session is choosing, not inventing.',
      },
    ],
  },
  {
    slug: 'batch-content-in-one-sitting',
    title: 'How to batch a week of content in one sitting',
    description:
      'A two-hour process for producing a week of posts without the quality drop that usually comes with batching.',
    date: '2026-06-08',
    tag: 'Strategy',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Batching gets criticised for making content feel mass-produced. That happens when people batch writing and publishing together. Separate the two and the problem disappears.',
      },
      { t: 'h', c: 'The two-hour block' },
      {
        t: 'ul',
        c: [
          '20 minutes — choose. Pull five ideas from your backlog and cut them to three.',
          '50 minutes — write. Draft all three captions without editing any of them.',
          '30 minutes — edit. Read each one out loud and fix the opener.',
          '20 minutes — schedule. Pick times, attach media, put them in the queue.',
        ],
      },
      { t: 'h', c: 'Write without editing' },
      {
        t: 'p',
        c: 'Editing while drafting is what makes batching slow and the results flat. Get all three drafts down first, then switch modes.',
      },
      { t: 'h', c: 'Leave one slot open' },
      {
        t: 'p',
        c: 'Batch four posts, not five. The open slot is for something timely that week — and it is what stops a batched week feeling like a batched week.',
      },
    ],
  },
  {
    slug: 'social-media-metrics-that-matter',
    title: 'The social media metrics that actually matter',
    description:
      'Follower count is a vanity metric. Here is what to track instead, and what to ignore.',
    date: '2026-06-01',
    tag: 'Growth',
    minutes: 7,
    body: [
      {
        t: 'p',
        c: 'Most dashboards show twenty numbers and tell you nothing. You need four, and you need them per post rather than averaged across the account.',
      },
      { t: 'h', c: 'The four' },
      {
        t: 'ul',
        c: [
          'Saves and shares — the clearest signal that content was worth keeping. Weight these highest.',
          'Replies and comments — evidence of a real audience, not a passive one.',
          'Profile visits per post — did the post make anyone curious about you?',
          'Clicks — only if you actually sell something. Otherwise ignore them.',
        ],
      },
      { t: 'h', c: 'What to ignore' },
      {
        t: 'p',
        c: 'Follower count grows as a side effect, not a cause. Impressions without engagement measure how often you posted, not how well. And likes, on their own, tell you almost nothing about whether a post did any work.',
      },
      { t: 'h', c: 'Track by format, not by week' },
      {
        t: 'p',
        c: 'A weekly total hides everything useful. Compare carousels to single images, threads to standalone posts. That comparison is what changes your next month.',
      },
      { t: 'h', c: 'One honest review a month' },
      {
        t: 'p',
        c: 'Pull your top three and bottom three posts from the month. Write one sentence on what separated them. That sentence is your strategy for next month — and it is more useful than any dashboard.',
      },
    ],
  },
  {
    slug: 'posting-consistency-systems',
    title: 'Systems that make posting consistency automatic',
    description:
      'Consistency is not willpower. It is having three posts ready before you need them.',
    date: '2026-05-25',
    tag: 'Strategy',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'Accounts do not stall because people stop caring. They stall because the queue ran dry and posting became a decision again.',
      },
      { t: 'h', c: 'Stay three ahead' },
      {
        t: 'p',
        c: 'The single most effective rule: never let the queue drop below three scheduled posts. Three is enough of a buffer to survive a bad week, and small enough to stay current.',
      },
      { t: 'h', c: 'Reduce the cost of starting' },
      {
        t: 'ul',
        c: [
          'Keep a running idea list so you never start from nothing.',
          'Reuse formats. Same shape, new content.',
          'Delete nothing. Failed drafts are raw material.',
        ],
      },
      { t: 'h', c: 'Let scheduling carry the discipline' },
      {
        t: 'p',
        c: 'Once posts are scheduled, consistency stops depending on your mood on any given morning. The queue publishes whether or not you feel like posting — which is the entire point.',
      },
    ],
  },
  {
    slug: 'automation-vs-scheduling',
    title: 'Automation vs scheduling: what to automate and what to keep manual',
    description:
      'Automate the mechanics, keep the judgement. A line-by-line guide.',
    date: '2026-05-18',
    tag: 'Product',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'Automation gets a bad name when it replaces the wrong parts. Nobody wants a bot replying to customers in your voice; everybody wants their scheduled posts to actually go out.',
      },
      { t: 'h', c: 'Automate this' },
      {
        t: 'ul',
        c: [
          'Publishing at a set time.',
          'Cross-posting an approved post to its target channels.',
          'Resizing and formatting for each channel.',
          'Recycling evergreen content on a schedule.',
        ],
      },
      { t: 'h', c: 'Keep this manual' },
      {
        t: 'ul',
        c: [
          'Replies and direct messages.',
          'Anything responding to news or a crisis.',
          'Approvals on sensitive posts.',
          'Deciding what to say in the first place.',
        ],
      },
      { t: 'h', c: 'The test' },
      {
        t: 'p',
        c: 'If the action is identical every time and carries no judgement, automate it. If it requires context or taste, keep it human. Most social tools blur that line; the good ones make it obvious where each action sits.',
      },
    ],
  },
  {
    slug: 'evergreen-content-recycling',
    title: 'How to recycle evergreen content without repeating yourself',
    description:
      'Bring back your best posts on a schedule — with enough change that regulars do not notice.',
    date: '2026-05-11',
    tag: 'Growth',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'Most of your audience never saw your best post. Recycling is not laziness; it is acknowledging that feeds are ephemeral and attention is distributed unevenly.',
      },
      { t: 'h', c: 'Find what deserves recycling' },
      {
        t: 'p',
        c: 'Look for posts with high saves and shares relative to reach, and posts that are still true a year later. Timely commentary does not recycle; explanations and frameworks do.',
      },
      { t: 'h', c: 'Change one thing every time' },
      {
        t: 'ul',
        c: [
          'New opener — same point, different first sentence.',
          'New format — text post becomes a carousel.',
          'New example — the framing stays, the illustration updates.',
        ],
      },
      { t: 'h', c: 'Space it out' },
      {
        t: 'p',
        c: 'Ninety days is the shortest interval that feels fresh. Longer is fine. Put the recycled post on the calendar at scheduling time so it comes round without you remembering.',
      },
    ],
  },
  {
    slug: 'instagram-reels-vs-tiktok',
    title: 'Instagram Reels vs TikTok: what actually differs',
    description:
      'Same vertical video, different rules. Where each platform rewards you, and where it punishes a repost.',
    date: '2026-05-04',
    tag: 'Strategy',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Both are vertical video. Beyond that, the audiences, the retention curve and the growth mechanics diverge enough that the same upload performs differently on each.',
      },
      { t: 'h', c: 'Where they differ' },
      {
        t: 'ul',
        c: [
          'Discovery: TikTok is built for strangers; Reels leans more on existing followers.',
          'Retention: TikTok forgives a rough look if the hook is strong. Reels rewards a cleaner finish.',
          'Saves: Reels audiences save tutorials at a much higher rate.',
          'Sound: TikTok runs on trends; Reels is more forgiving of original audio.',
        ],
      },
      { t: 'h', c: 'Do not repost the watermark' },
      {
        t: 'p',
        c: 'Both platforms down-rank video carrying a competitor watermark, and viewers recognise it instantly. Export clean and re-upload to each.',
      },
      { t: 'h', c: 'Change the first second' },
      {
        t: 'p',
        c: 'The cheapest way to make one clip work on both is a different opening second — a different hook line, a different first frame. It costs two minutes and avoids the "reposted" feel.',
      },
    ],
  },
  {
    slug: 'linkedin-posts-that-get-read',
    title: 'LinkedIn posts that actually get read',
    description:
      'The formatting and opening-line rules that decide whether your post is expanded or scrolled past.',
    date: '2026-04-27',
    tag: 'Growth',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'LinkedIn collapses a post after roughly two lines. Everything you write past that point only exists for people your opening earned.',
      },
      { t: 'h', c: 'The opening line' },
      {
        t: 'ul',
        c: [
          'Lead with the result, not the setup: "We cut onboarding from 14 days to 3."',
          'Avoid the question opener — it reads as a template.',
          'Never open with "I\'m excited to announce".',
        ],
      },
      { t: 'h', c: 'Formatting' },
      {
        t: 'p',
        c: 'One or two sentences per paragraph. White space is what makes a 300-word post feel short. Keep the total between 150 and 300 words — long enough to be substantive, short enough to finish.',
      },
      { t: 'h', c: 'Links and hashtags' },
      {
        t: 'p',
        c: 'A link in the post body suppresses reach, so put it in the first comment. Three relevant hashtags is the ceiling; more looks like spam.',
      },
      { t: 'h', c: 'The ending' },
      {
        t: 'p',
        c: 'Ask one specific question. "Which of these two approaches do you use?" gets answers; "thoughts?" does not.',
      },
    ],
  },
  {
    slug: 'bluesky-vs-mastodon-vs-threads',
    title: 'Bluesky vs Mastodon vs Threads: which should you post to?',
    description:
      'Three short-form networks with very different cultures. How to choose, or run all three without extra work.',
    date: '2026-04-20',
    tag: 'Strategy',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'The three alternatives to X are not interchangeable. They have different lengths, different norms and different reasons people are there.',
      },
      { t: 'h', c: 'Bluesky' },
      {
        t: 'p',
        c: '300 characters, custom feeds, a technical and creative audience. Alt text on images is expected. Good for short takes and linking to longer work.',
      },
      { t: 'h', c: 'Mastodon' },
      {
        t: 'p',
        c: '500 characters on most servers, federated, community-minded. Hashtags genuinely help discovery here. Content warnings and alt text are social norms, not optional extras.',
      },
      { t: 'h', c: 'Threads' },
      {
        t: 'p',
        c: '500 characters, conversational, replies regularly out-reach originals. Hashtags do almost nothing. Write like you are texting, not broadcasting.',
      },
      { t: 'h', c: 'Which one' },
      {
        t: 'p',
        c: 'If your audience is technical, Mastodon and Bluesky. If it is consumer-facing, Threads. If you cannot choose, the answer is usually "all three with an adapted caption" — the same core post, adjusted for each network\'s length and tone.',
      },
    ],
  },
  {
    slug: 'youtube-shorts-strategy',
    title: 'A YouTube Shorts strategy for people who already post Reels',
    description:
      'You are already making vertical video. Here is how to get a second and third life out of it on YouTube.',
    date: '2026-04-13',
    tag: 'Growth',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'If you are producing vertical clips for Reels and TikTok, Shorts is close to free reach — with two adjustments.',
      },
      { t: 'h', c: 'The two adjustments' },
      {
        t: 'ul',
        c: [
          'Length: keep Shorts under 3 minutes, and aim for 20–40 seconds to maximise completion.',
          'Title: Short titles are searchable, unlike captions elsewhere. Write one with the phrase people would search.',
        ],
      },
      { t: 'h', c: 'Cut Shorts from long-form' },
      {
        t: 'p',
        c: 'If you publish long videos, the strongest Shorts are the best 30 seconds of them — a single insight with a clear opening. Pull three or four from each upload and schedule them over the next fortnight.',
      },
      { t: 'h', c: 'Do not neglect the description' },
      {
        t: 'p',
        c: 'YouTube is a search engine first. A 5,000-character description is free real estate: write a real summary, then timestamps, then links.',
      },
    ],
  },
  {
    slug: 'pinterest-for-traffic',
    title: 'Pinterest is a search engine: how to use it for traffic',
    description:
      'Why a pin can outperform a tweet for months, and how to set up your profile for it.',
    date: '2026-04-06',
    tag: 'Growth',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Every other channel you post to peaks in hours then disappears. A Pinterest pin can send traffic for a year, because it is indexed rather than ranked by recency.',
      },
      { t: 'h', c: 'Set up for search' },
      {
        t: 'ul',
        c: [
          'Convert to a business account — required for scheduling and analytics.',
          'Write a profile description with the words people search for.',
          'Name your boards after topics, not clever phrases.',
        ],
      },
      { t: 'h', c: 'Design the pin correctly' },
      {
        t: 'p',
        c: '2:3 vertical at 1000×1500, not 9:16. Text on the image should be readable at thumbnail size — one clear headline, not a paragraph.',
      },
      { t: 'h', c: 'Write the description like a query' },
      {
        t: 'p',
        c: 'Describe what the pin shows using the exact words someone would type. That is the text Pinterest indexes, and it matters far more than hashtags.',
      },
      { t: 'h', c: 'Post for the long game' },
      {
        t: 'p',
        c: 'A few pins a week, consistently, builds a library. A burst followed by silence does nothing — Pinterest rewards accounts that keep feeding the index.',
      },
    ],
  },
  {
    slug: 'social-media-manager-daily-checklist',
    title: 'The daily checklist for a social media manager',
    description:
      'A 25-minute morning routine that keeps the queue healthy and the replies answered.',
    date: '2026-03-30',
    tag: 'Teams',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'Most social media management is maintenance, and maintenance benefits enormously from a fixed routine. This one takes about 25 minutes.',
      },
      { t: 'h', c: 'The routine' },
      {
        t: 'ul',
        c: [
          '5 min — check what published overnight. Confirm nothing failed.',
          '5 min — clear the approval queue. Approve or send back with a note.',
          '10 min — reply to comments and messages on the posts from the last 48 hours.',
          '5 min — confirm tomorrow is scheduled and the queue is at least three deep.',
        ],
      },
      { t: 'h', c: 'What to do when something failed' },
      {
        t: 'p',
        c: 'A failed post is usually an expired token or a rejected format. Reconnect the channel, fix the media, and reschedule. Do not delete and rewrite — that loses the original timing.',
      },
      { t: 'h', c: 'Once a week, not once a day' },
      {
        t: 'p',
        c: 'Numbers reviewed daily produce anxiety, not insight. Review performance once a week, on the same day, and write one sentence about what to change.',
      },
    ],
  },
  {
    slug: 'choosing-a-social-media-scheduler',
    title: 'How to choose a social media scheduler',
    description:
      'The questions that separate a tool that fits from one you abandon in a month.',
    date: '2026-03-23',
    tag: 'Product',
    minutes: 6,
    body: [
      {
        t: 'p',
        c: 'Most schedulers look identical in a demo: a calendar, a composer, some charts. The differences only surface once you are using one daily.',
      },
      { t: 'h', c: 'Ask these before you commit' },
      {
        t: 'ul',
        c: [
          'Which channels do I actually use, and are all of them supported for publishing — not just for analytics?',
          'Does it handle the formats I post, like carousels and threads?',
          'What happens when a token expires? Do I find out, or does a post silently fail?',
          'Can a teammate draft without being able to publish?',
          'Is pricing per channel or flat? Per-channel pricing punishes you for using the tool properly.',
        ],
      },
      { t: 'h', c: 'The publishing question is the real one' },
      {
        t: 'p',
        c: 'Plenty of tools support reading analytics from a network but not publishing to it. Verify publishing per channel before you migrate anything.',
      },
      { t: 'h', c: 'Prefer flat pricing' },
      {
        t: 'p',
        c: 'Per-channel pricing creates a perverse incentive: the more places you post, the more the tool costs. Flat pricing lets you use it the way it was designed to be used.',
      },
      { t: 'h', c: 'Then decide on the boring things' },
      {
        t: 'p',
        c: 'Reliability, a clear queue, and an approval flow that takes a minute per post matter more than any feature list. If a tool does those three well, it is worth keeping.',
      },
    ],
  },
  {
    slug: 'what-is-a-publishing-queue',
    title: 'What a publishing queue is, and why it beats posting manually',
    description:
      'The queue is the least glamorous feature in any scheduler and the one that changes how you work.',
    date: '2026-03-16',
    tag: 'Product',
    minutes: 5,
    body: [
      {
        t: 'p',
        c: 'A publishing queue is the list of posts that are approved and waiting for their scheduled moment. It sounds trivial. It is the difference between posting as a habit and posting as a chore.',
      },
      { t: 'h', c: 'What the queue gives you' },
      {
        t: 'ul',
        c: [
          'You can be away from your phone at posting time.',
          'You can see, at a glance, whether the week is genuinely covered.',
          'You can move a post to a better time without rewriting it.',
          'Failures are visible in one place instead of scattered across apps.',
        ],
      },
      { t: 'h', c: 'Statuses worth understanding' },
      {
        t: 'p',
        c: 'Draft means not scheduled. Queued means it will publish at its time. Publishing is the in-flight moment. Sent is done. Partial means some channels succeeded and others did not. Failed needs your attention — usually a reconnection.',
      },
      { t: 'h', c: 'The habit' },
      {
        t: 'p',
        c: 'Never let the queue fall below three posts. That single rule does more for consistency than any content strategy, because it guarantees posting no longer depends on today.',
      },
    ],
  },
];

/** Newest first. */
export function allArticles(): Article[] {
  return [...ARTICLES].sort((a, b) => b.date.localeCompare(a.date));
}

export function article(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function articlesByTag(tag: string): Article[] {
  return allArticles().filter((a) => a.tag === tag);
}

export function relatedArticles(slug: string, count = 3): Article[] {
  const current = article(slug);
  if (!current) return allArticles().slice(0, count);
  const sameTag = allArticles().filter((a) => a.slug !== slug && a.tag === current.tag);
  const rest = allArticles().filter((a) => a.slug !== slug && a.tag !== current.tag);
  return [...sameTag, ...rest].slice(0, count);
}

export const BLOG_TAGS = ['Publishing', 'Strategy', 'AI', 'Teams', 'Growth', 'Product'] as const;
