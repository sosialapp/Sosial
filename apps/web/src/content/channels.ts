import type { ChannelGuide } from './types';

/**
 * One guide per channel Sosial publishes to. Every number here is the real
 * platform limit at time of writing — if a limit changes, it changes here and
 * the composer, channel pages and pricing pages all follow.
 */
export const CHANNEL_GUIDES: ChannelGuide[] = [
  {
    key: 'instagram',
    name: 'Instagram',
    tagline: 'Reels, carousels and stories that reward the first three seconds.',
    intro:
      'Instagram is a visual-first feed where reach is driven by watch time and saves, not by how many hashtags you stack. Sosial schedules your Reels and carousels alongside every other channel so a single idea can ship as a 9:16 video here and a text post elsewhere.',
    limit: 2200,
    bestFor: [
      'Reels and short vertical video',
      'Carousels that teach one idea per slide',
      'Behind-the-scenes and product close-ups',
    ],
    facts: [
      { label: 'Caption limit', value: '2,200 characters' },
      { label: 'Carousel', value: 'Up to 20 images or videos' },
      { label: 'Reels length', value: 'Up to 3 minutes' },
      { label: 'Hashtags', value: '30 max: fewer, more specific wins' },
    ],
    tips: [
      {
        title: 'Write the first line for the collapsed caption',
        body: 'Only the first ~125 characters show before "more". Put the hook there, then use line breaks to control the truncation.',
      },
      {
        title: 'Front-load the visual hook',
        body: 'Keep the opening frame of a Reel readable at thumbnail size: large subject, high contrast, on-screen text under six words.',
      },
      {
        title: 'Batch carousels from one blog post',
        body: 'Turn each section heading into a slide, and the closing slide into a soft call to action. One article becomes a week of carousels.',
      },
    ],
    pitfalls: [
      'Reusing a 16:9 landscape upload. It letterboxes and loses reach.',
      'Copy-pasting the same caption to Instagram and X, where the tone should differ.',
      'Hashtag blocks of 30 generic tags that read as spam.',
    ],
    faqs: [
      {
        q: 'Can Sosial post carousels to Instagram?',
        a: 'Yes. Attach up to 20 images in the composer and they publish in order as a single carousel post.',
      },
      {
        q: 'Does Sosial publish Reels?',
        a: 'Yes. Attach one vertical video and it publishes as a Reel on the connected Instagram business account.',
      },
      {
        q: 'What caption length should I aim for?',
        a: 'Under 300 characters for promotional posts, up to 2,200 for educational ones. The composer counts characters as you type.',
      },
    ],
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    tagline: 'Native-feeling vertical video, scheduled without the app.',
    intro:
      'TikTok rewards content that looks like it belongs on TikTok. Sosial queues your vertical videos with their captions and publishes them on schedule, so you can batch a week of clips in one sitting.',
    limit: 2200,
    bestFor: ['9:16 video under 60 seconds', 'Trend-led clips', 'Educational series with a recurring hook'],
    facts: [
      { label: 'Caption limit', value: '2,200 characters' },
      { label: 'Aspect ratio', value: '9:16, 1080×1920' },
      { label: 'Ideal length', value: '15–60 seconds for completion rate' },
      { label: 'Hashtags', value: '3–5 relevant tags beat 20 generic ones' },
    ],
    tips: [
      {
        title: 'Say the hook in the first second',
        body: 'TikTok decides distribution on early retention. Start mid-sentence if it earns attention faster.',
      },
      {
        title: 'Design for sound-off and sound-on',
        body: 'Burn in captions so the clip works muted, and pick a trending audio so it works unmuted too.',
      },
      {
        title: 'Schedule a series, not a one-off',
        body: 'Three clips a week on the same theme compounds far faster than a single viral attempt.',
      },
    ],
    pitfalls: [
      'Re-uploading a watermarked video from another platform.',
      'Long intros before the hook. Most viewers have already scrolled.',
      'Posting the same clip to Reels and TikTok with the identical caption and no re-cut.',
    ],
    faqs: [
      {
        q: 'Can I schedule TikTok videos from the web?',
        a: 'Yes. Upload the vertical video, write the caption, pick a time, and the worker publishes it to your connected TikTok account.',
      },
      {
        q: 'Do I need a business account?',
        a: 'A TikTok business account is required for API publishing. Connect it once and it appears across every Sosial surface.',
      },
      {
        q: 'What format should I upload?',
        a: 'MP4 at 1080×1920, ideally under 60 seconds and under 100 MB for the fastest upload.',
      },
    ],
  },
  {
    key: 'x',
    name: 'X',
    tagline: 'Threads that hold attention, written and scheduled in one pass.',
    intro:
      'X is the fastest channel to test an idea and the least forgiving of a rambling opener. Sosial lets you write a thread as a single piece, with a live character count per post, then schedule it across your other channels.',
    limit: 280,
    bestFor: ['Threads that build an argument', 'Timely commentary', 'Product and build-in-public updates'],
    facts: [
      { label: 'Post limit', value: '280 characters' },
      { label: 'Threads', value: 'No hard cap: keep each post self-contained' },
      { label: 'Media', value: 'Up to 4 images or 1 video per post' },
      { label: 'Links', value: 'The card no longer counts toward the limit' },
    ],
    tips: [
      {
        title: 'One idea per post',
        body: 'A thread works when each post could stand alone. If a post needs the next one to make sense, cut it shorter.',
      },
      {
        title: 'No throat-clearing',
        body: 'Delete "Let me explain", "A thread 🧵", and the rest. State the claim first.',
      },
      {
        title: 'Keep promotional posts under 200 characters',
        body: 'Short posts with a single clear link consistently outperform dense ones on X.',
      },
    ],
    pitfalls: [
      'Splitting a paragraph mid-sentence across two posts.',
      'Threads with no payoff. The last post should land the point, not trail off.',
      'Scheduling a time-sensitive take for tomorrow.',
    ],
    faqs: [
      {
        q: 'Does Sosial support threads?',
        a: 'Yes. Write the thread as numbered posts in the composer; Sosial publishes them in order as a connected chain.',
      },
      {
        q: 'Can I write a long post and let Sosial split it?',
        a: 'The composer warns you when a post exceeds 280 characters, so you decide where the break lands rather than leaving it to an automatic split.',
      },
      {
        q: 'Can I schedule the same thread elsewhere?',
        a: 'Yes. Target X, Threads, Bluesky and Mastodon together. Each gets its own character limit applied.',
      },
    ],
  },
  {
    key: 'facebook',
    name: 'Facebook',
    tagline: 'The widest caption limit, and the most forgiving scheduling window.',
    intro:
      'Facebook Pages still reach the largest broad-interest audience of any channel, and the 63,206-character caption limit makes it the one place a full article reads naturally. Sosial publishes to your Page on schedule.',
    limit: 63206,
    bestFor: ['Longer storytelling posts', 'Community questions', 'Event and launch announcements'],
    facts: [
      { label: 'Caption limit', value: '63,206 characters' },
      { label: 'Media', value: 'Photo, video, or a link preview' },
      { label: 'Best length', value: '40–80 words for engagement, longer for storytelling' },
      { label: 'Peak times', value: 'Weekday mornings and early afternoon' },
    ],
    tips: [
      {
        title: 'Use the first two lines as a hook',
        body: 'Facebook truncates after roughly 250 characters on mobile. Earn the "See more" tap.',
      },
      {
        title: 'Ask one specific question',
        body: 'A concrete question ("which of these two covers works better?") gets far more comments than "thoughts?".',
      },
      {
        title: 'Post native media, not a bare link',
        body: 'Native images and video out-reach link posts. Put the link in the first comment if you need the click.',
      },
    ],
    pitfalls: [
      'Cross-posting an X-length post that reads as an afterthought.',
      'Engagement-bait phrasing that the algorithm suppresses.',
      'Posting a link with no context. Facebook down-ranks it.',
    ],
    faqs: [
      {
        q: 'Pages or personal profiles?',
        a: 'Sosial connects Facebook Pages, which is what the publishing API supports. Personal profiles are not eligible.',
      },
      {
        q: 'Why is my caption truncated?',
        a: 'That is Facebook\'s own preview behaviour, the full text is always published, it is only collapsed in the feed.',
      },
      {
        q: 'Can I schedule to Facebook and Instagram at once?',
        a: 'Yes. Both are Meta channels, so one composer post can target both with a caption tailored to each.',
      },
    ],
  },
  {
    key: 'threads',
    name: 'Threads',
    tagline: 'Conversational posts where a reply can out-reach the original.',
    intro:
      'Threads favours plain, conversational text and rewards replies. It has no hashtag culture, so reach comes from a strong opening line and being genuinely worth answering.',
    limit: 500,
    bestFor: ['Opinions and questions', 'Casual product updates', 'Chains that continue a thought'],
    facts: [
      { label: 'Post limit', value: '500 characters' },
      { label: 'Media', value: 'Up to 10 items per post' },
      { label: 'Links', value: 'Included in the 500-character count' },
      { label: 'Culture', value: 'Hashtags do very little. Skip them' },
    ],
    tips: [
      {
        title: 'Write like a message, not a billboard',
        body: 'Lowercase, direct, first person. Threads reads more like a group chat than a broadcast network.',
      },
      {
        title: 'Leave a gap for replies',
        body: 'A post that fully closes its own argument gives nobody a reason to answer. End with the open question.',
      },
      {
        title: 'Chain long ideas deliberately',
        body: 'Use a chain when an idea genuinely needs it, and keep each link short. 500 characters is a hard stop.',
      },
    ],
    pitfalls: [
      'Pasting a wall of hashtags from an Instagram caption.',
      'Posting an identical copy of an X post with no tonal change.',
      'Long chains where the second post is weaker than the first.',
    ],
    faqs: [
      {
        q: 'Is Threads the same as X?',
        a: 'No. Threads reads more conversational, has a 500-character limit, and gains little from hashtags. Write differently for each.',
      },
      {
        q: 'Can Sosial post chains to Threads?',
        a: 'Yes. Threads is one of the four channels that supports connected chains in the composer.',
      },
      {
        q: 'Should I include links?',
        a: 'Only when the link is the point. Threads links count against the 500-character limit and tend to reduce replies.',
      },
    ],
  },
  {
    key: 'youtube',
    name: 'YouTube',
    tagline: 'Long-form and Shorts from the same queue.',
    intro:
      'YouTube is two products in one: a search engine for long-form video and a vertical feed for Shorts. Sosial schedules both, with the title and description fields where discoverability actually happens.',
    limit: 5000,
    bestFor: ['Tutorials and reviews', 'Shorts from vertical clips', 'Evergreen search-driven content'],
    facts: [
      { label: 'Description limit', value: '5,000 characters' },
      { label: 'Title limit', value: '100 characters' },
      { label: 'Shorts', value: 'Vertical, up to 3 minutes' },
      { label: 'Tags', value: '500 characters total, low impact' },
    ],
    tips: [
      {
        title: 'Put keywords in the title, naturally',
        body: 'The title is the single strongest ranking signal. Name the thing people would search for.',
      },
      {
        title: 'First two lines of the description matter most',
        body: 'Write a genuine summary, then the timestamps, then the links.',
      },
      {
        title: 'Cut vertical clips from long-form',
        body: 'One 10-minute video can yield five Shorts. Schedule them across the following fortnight.',
      },
    ],
    pitfalls: [
      'Uploading landscape video as a Short. It will letterbox.',
      'Keyword-stuffed titles that read as spam to humans.',
      'Leaving the description empty when it is free search real estate.',
    ],
    faqs: [
      {
        q: 'Can Sosial upload to YouTube?',
        a: 'Yes. Connect the channel and schedule uploads with the title, description and visibility you set in the composer.',
      },
      {
        q: 'Does it support Shorts?',
        a: 'A vertical video under 3 minutes publishes as a Short automatically.',
      },
      {
        q: 'Can I set a publish time instead of going live immediately?',
        a: 'Yes. Schedule it in Sosial and the worker uploads at that moment.',
      },
    ],
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    tagline: 'First two lines decide whether a post gets read.',
    intro:
      'LinkedIn collapses posts after roughly two lines on mobile, so the opening sentences do nearly all the work. The 3,000-character limit is generous. The constraint is attention, not space.',
    limit: 3000,
    bestFor: ['Lessons and case studies', 'Hiring and company news', 'Industry analysis'],
    facts: [
      { label: 'Post limit', value: '3,000 characters' },
      { label: 'Preview cutoff', value: '~140 characters before "see more"' },
      { label: 'Media', value: 'Image, video, document or poll' },
      { label: 'Links', value: 'Put them in the first comment to protect reach' },
    ],
    tips: [
      {
        title: 'Open with a specific claim',
        body: '"We cut onboarding from 14 days to 3" beats "Onboarding is important". Specificity earns the tap.',
      },
      {
        title: 'Break every paragraph after one or two lines',
        body: 'Short paragraphs read as scannable on mobile and give the post rhythm.',
      },
      {
        title: 'Ask for one thing at the end',
        body: 'A single clear question or invitation outperforms three competing calls to action.',
      },
    ],
    pitfalls: [
      'Burying the point under a warm-up paragraph.',
      'Hashtag stuffing: three relevant tags is the ceiling.',
      'Reposting an Instagram caption with emoji-heavy formatting.',
    ],
    faqs: [
      {
        q: 'Company pages or personal profiles?',
        a: 'Sosial connects LinkedIn company pages, which is what the API supports.',
      },
      {
        q: 'Should links go in the post or the comments?',
        a: 'The first comment usually preserves more reach. Sosial publishes the post; add the comment from the app.',
      },
      {
        q: 'How long should a LinkedIn post be?',
        a: 'Aim for 150–300 words. Long enough to be substantive, short enough to finish.',
      },
    ],
  },
  {
    key: 'bluesky',
    name: 'Bluesky',
    tagline: 'Short, honest posts with a feed you can actually influence.',
    intro:
      'Bluesky is an open network with a 300-character limit and custom feeds rather than one algorithmic timeline. Using the right feed-friendly language matters more than timing.',
    limit: 300,
    bestFor: ['Short takes', 'Developer and researcher audiences', 'Linking to long-form work'],
    facts: [
      { label: 'Post limit', value: '300 characters' },
      { label: 'Media', value: 'Up to 4 images or 1 video' },
      { label: 'Links', value: 'Count toward the limit; a card is generated' },
      { label: 'Culture', value: 'Alt text on images is expected' },
    ],
    tips: [
      {
        title: 'Add alt text to every image',
        body: 'It is a strong norm on Bluesky and makes posts accessible. It also shows up in search.',
      },
      {
        title: 'Post smaller and more often',
        body: '300 characters suits a quick observation. Save the essay for Threads or LinkedIn.',
      },
      {
        title: 'Write for feeds, not a clock',
        body: 'Chronological and custom feeds mean consistency beats timing far more than it does elsewhere.',
      },
    ],
    pitfalls: [
      'Threads longer than three or four posts.',
      'Ignoring alt text. It reads as careless to a technical audience.',
      'Cross-posting marketing copy verbatim from X.',
    ],
    faqs: [
      {
        q: 'Do I need a custom domain handle?',
        a: 'No, but a domain handle (like @yoursite.com) is a trust signal. Sosial publishes to whichever handle the account uses.',
      },
      {
        q: 'Can I schedule Bluesky posts?',
        a: 'Yes, alongside every other channel, with the 300-character limit enforced in the composer.',
      },
      {
        q: 'Do hashtags work on Bluesky?',
        a: 'They are clickable but minor. A clear sentence does more.',
      },
    ],
  },
  {
    key: 'mastodon',
    name: 'Mastodon',
    tagline: 'Community-first posting, with content warnings done properly.',
    intro:
      'Mastodon is a federated network of independent servers. Etiquette carries more weight here than reach mechanics: use alt text, use content warnings, and do not treat it as a broadcast channel.',
    limit: 500,
    bestFor: ['Technical communities', 'Open-source and research updates', 'Longer-form discussion'],
    facts: [
      { label: 'Post limit', value: '500 characters on most servers' },
      { label: 'Media', value: 'Up to 4 images or 1 video' },
      { label: 'Culture', value: 'Content warnings and alt text are expected' },
      { label: 'Reach', value: 'Hashtags genuinely help discovery here' },
    ],
    tips: [
      {
        title: 'Use content warnings for sensitive topics',
        body: 'A content warning is a courtesy, not a downgrade. It keeps your post welcome in more timelines.',
      },
      {
        title: 'Use two or three real hashtags',
        body: 'Unlike most networks, well-chosen hashtags materially improve discovery on Mastodon.',
      },
      {
        title: 'Engage with replies properly',
        body: 'Boosts and replies matter more than follower count. A conversational account grows fastest.',
      },
    ],
    pitfalls: [
      'Assuming one server speaks for the whole network.',
      'Auto-cross-posting identical marketing copy from X.',
      'Posting images without alt text.',
    ],
    faqs: [
      {
        q: 'Which Mastodon server should I use?',
        a: 'Any server works. Sosial connects to the instance you sign in from. Pick one that matches your topic.',
      },
      {
        q: 'Why is my limit different from someone else\'s?',
        a: 'Mastodon servers can raise the 500-character default. The composer uses your instance\'s real limit where available.',
      },
      {
        q: 'Does Sosial support Mastodon threads?',
        a: 'Yes, Mastodon is one of the chain-capable channels.',
      },
    ],
  },
  {
    key: 'pinterest',
    name: 'Pinterest',
    tagline: 'Evergreen discovery where a pin keeps working for months.',
    intro:
      'Pinterest behaves like a visual search engine. A single vertical pin can drive traffic for a year, which makes it the highest-leverage channel for anything instructional or product-led.',
    limit: 500,
    bestFor: ['How-to graphics', 'Product imagery', 'Seasonal and evergreen content'],
    facts: [
      { label: 'Description limit', value: '500 characters' },
      { label: 'Title limit', value: '100 characters' },
      { label: 'Image ratio', value: '2:3 vertical, 1000×1500' },
      { label: 'Lifespan', value: 'Months, not hours' },
    ],
    tips: [
      {
        title: 'Design at 2:3, not 9:16',
        body: 'Vertical is right, but Pinterest\'s ratio is 2:3. A 9:16 Story graphic gets cropped.',
      },
      {
        title: 'Write the description like a search query',
        body: 'Describe what the pin shows using the words people would type. That is what gets indexed.',
      },
      {
        title: 'Re-pin your own best work seasonally',
        body: 'Reschedule a proven pin ahead of the season it fits and it earns traffic again.',
      },
    ],
    pitfalls: [
      'Uploading landscape or square images. They get cropped or ignored.',
      'Keyword-free descriptions that give the indexer nothing to work with.',
      'Treating Pinterest like a fast-moving feed and giving up after a week.',
    ],
    faqs: [
      {
        q: 'Do I need a Pinterest business account?',
        a: 'Yes for API publishing. It is free to convert and unlocks analytics as well.',
      },
      {
        q: 'Can I schedule pins?',
        a: 'Yes. Schedule pins alongside every other channel in the same composer.',
      },
      {
        q: 'How many pins should I post?',
        a: 'A few a week consistently beats a burst. Pinterest rewards a steady library.',
      },
    ],
  },
  {
    key: 'telegram',
    name: 'Telegram',
    tagline: 'Channels and groups that reach subscribers without an algorithm in the way.',
    intro:
      'Telegram delivers to everyone who opted in — no ranking, no reach throttling. Sosial connects your bot to a channel or group and queues messages with formatting and media intact, so an announcement lands the moment you schedule it.',
    limit: 1024,
    bestFor: ['Product and release announcements', 'Community updates for a channel', 'Time-sensitive drops'],
    facts: [
      { label: 'Message limit', value: '1,024 characters' },
      { label: 'Media', value: 'Photos, video, documents and albums' },
      { label: 'Formatting', value: 'Bold, italic, links and monospace via Markdown' },
      { label: 'Delivery', value: 'Chronological — no feed algorithm' },
    ],
    tips: [
      {
        title: 'Write for the notification, not the archive',
        body: 'The first line is what shows in a push. Lead with the news, not the preamble.',
      },
      {
        title: 'Use formatting to make it scannable',
        body: 'Bold the key line and put details on their own lines. A wall of plain text gets skimmed and closed.',
      },
      {
        title: 'Keep the cadence predictable',
        body: 'Subscribers stay for a reason. A steady rhythm of useful posts beats occasional bursts nobody expected.',
      },
    ],
    pitfalls: [
      'Treating a channel like a broadcast billboard and posting every hour.',
      'Long blocks of text with no line breaks on mobile.',
      'Broken links that Telegram previews but the reader cannot open.',
    ],
    faqs: [
      {
        q: 'Can Sosial post to a Telegram channel?',
        a: 'Yes. Connect a bot to your channel and scheduled messages publish to it on time, with formatting preserved.',
      },
      {
        q: 'Does it work for groups too?',
        a: 'Yes. Point the bot at a group and Sosial posts there exactly as it does for a channel.',
      },
      {
        q: 'Is there a character limit I should worry about?',
        a: '1,024 characters per message. The composer counts against it and can split long copy across messages.',
      },
    ],
  },
  {
    key: 'discord',
    name: 'Discord',
    tagline: 'Announcements and updates that land in the right server channel.',
    intro:
      'Discord is where communities talk in real time, and announcements work best when they read like they came from a member, not a machine. Sosial posts scheduled updates to the channel you pick, so launches, changelogs and events arrive on cue.',
    limit: 2000,
    bestFor: ['Server announcements', 'Events and changelogs', 'Community engagement prompts'],
    facts: [
      { label: 'Message limit', value: '2,000 characters per message' },
      { label: 'Media', value: 'Images, video and files in a post' },
      { label: 'Markdown', value: 'Bold, italics, code blocks and links' },
      { label: 'Where it posts', value: 'The specific channel the bot is set to' },
    ],
    tips: [
      {
        title: 'Post to the right channel',
        body: 'An announcement belongs in #announcements, not #general. Route each message to the channel that fits.',
      },
      {
        title: 'Use code blocks for updates',
        body: 'A short changelog in a code block stays aligned and reads as a clear list of what changed.',
      },
      {
        title: 'Tag roles sparingly',
        body: 'A role ping pulls attention once. Reaching for it every post teaches the server to mute you.',
      },
    ],
    pitfalls: [
      'Posting to the wrong channel and burying the message in conversation.',
      'Overusing @everyone until members mute the server.',
      'Walls of text where a short bold headline plus a link would do.',
    ],
    faqs: [
      {
        q: 'Can Sosial post to a specific Discord channel?',
        a: 'Yes. When you connect the bot you choose the server and channel, and scheduled posts go there.',
      },
      {
        q: 'Does it support media?',
        a: 'Yes. Attach images or video in the composer and they publish with the message.',
      },
      {
        q: 'Will it ping a role?',
        a: 'Only if you include the mention in the message text — Sosial sends exactly what you write.',
      },
    ],
  },
  {
    key: 'wordpress',
    name: 'WordPress',
    tagline: 'Push posts from the calendar straight to your self-hosted site.',
    intro:
      'Your blog is still the home base your social posts point back to. Sosial connects to a WordPress site over its REST API and publishes scheduled posts with their title, body and featured image, so the article ships when you planned it.',
    limit: 100000,
    bestFor: ['Long-form articles', 'SEO-driven content', 'Scheduled publishing without logging in'],
    facts: [
      { label: 'Content limit', value: 'Effectively unlimited (100k+ characters)' },
      { label: 'Auth', value: 'Application password over the WordPress REST API' },
      { label: 'Media', value: 'Featured image and inline images' },
      { label: 'Status', value: 'Publish now, or schedule from Sosial' },
    ],
    tips: [
      {
        title: 'Set a featured image every time',
        body: 'It becomes the thumbnail on the blog and the preview card when the post is shared.',
      },
      {
        title: 'Write the excerpt yourself',
        body: 'A hand-written excerpt controls how the post reads in search results and social previews.',
      },
      {
        title: 'Cross-post the summary, not the article',
        body: 'Send a short teaser to social channels and link back, rather than pasting the whole piece.',
      },
    ],
    pitfalls: [
      'Revoking the application password so the connection silently fails.',
      'Publishing without a featured image and getting a blank preview card.',
      'Using a draft that is still half-written as a scheduled post.',
    ],
    faqs: [
      {
        q: 'How does Sosial connect to WordPress?',
        a: 'With an application password created in your WordPress user profile — no plugin required on recent versions.',
      },
      {
        q: 'Can I schedule a post for the future?',
        a: 'Yes. The post goes live at the time you set in Sosial, with an optional review before it publishes.',
      },
      {
        q: 'Does it support featured images?',
        a: 'Yes. Attach an image and Sosial sets it as the post featured image.',
      },
    ],
  },
  {
    key: 'devto',
    name: 'Dev.to',
    tagline: 'Developer articles, published where engineers actually read.',
    intro:
      'Dev.to is a blogging community built for technical writing. Sosial connects through the Dev.to API to publish your scheduled articles with tags, a cover image and canonical links, so the post appears in feeds and search on schedule.',
    limit: 100000,
    bestFor: ['Tutorials and deep dives', 'Release notes for developer tools', 'Technical opinion pieces'],
    facts: [
      { label: 'Content limit', value: 'Effectively unlimited (100k+ characters)' },
      { label: 'Auth', value: 'Dev.to API key' },
      { label: 'Tags', value: 'Up to 4 tags per post' },
      { label: 'Canonical', value: 'Point back to your own blog to avoid duplicate SEO' },
    ],
    tips: [
      {
        title: 'Pick four precise tags',
        body: 'Tags drive discovery on Dev.to. Choose the ones a developer would actually follow over broad vanity tags.',
      },
      {
        title: 'Set the canonical URL',
        body: 'If the piece also lives on your blog, set the canonical link so search engines credit the original.',
      },
      {
        title: 'Lead with the problem',
        body: 'Open with the bug or the goal, not the backstory. Developers skim until they find the part that helps.',
      },
    ],
    pitfalls: [
      'Tag stuffing with unrelated tags that bury the post.',
      'Publishing without a canonical URL and splitting SEO across two copies.',
      'Code samples without language hints, which render flat.',
    ],
    faqs: [
      {
        q: 'How do I connect Dev.to?',
        a: 'Generate an API key in your Dev.to settings and paste it into Sosial once; scheduled articles publish through it.',
      },
      {
        q: 'Can I set tags and a cover image?',
        a: 'Yes. Add tags and a cover image in the composer and they carry through to the published article.',
      },
      {
        q: 'Does it support canonical links?',
        a: 'Yes. Set the canonical URL so cross-posted articles point search engines back to your original.',
      },
    ],
  },
  {
    key: 'hashnode',
    name: 'Hashnode',
    tagline: 'Cross-post engineering writing to your own Hashnode blog.',
    intro:
      'Hashnode gives developers a personal blog with a strong built-in community. Sosial publishes through the Hashnode GraphQL API, so a scheduled article lands on your publication with its tags and cover image at the time you set.',
    limit: 100000,
    bestFor: ['Personal engineering blogs', 'Cross-posting from your own site', 'Community-led technical writing'],
    facts: [
      { label: 'Content limit', value: 'Effectively unlimited (100k+ characters)' },
      { label: 'Auth', value: 'Hashnode API token (Pro accounts)' },
      { label: 'Tags', value: 'Up to 5 tags per post' },
      { label: 'Canonical', value: 'Supported, for republished pieces' },
    ],
    tips: [
      {
        title: 'Choose a focused publication',
        body: 'Posting to a themed publication beats a personal blog with no through-line for discovery.',
      },
      {
        title: 'Reuse your canonical URL',
        body: 'Republishing from your own blog? Set the original URL so credit stays where it belongs.',
      },
      {
        title: 'Front-load a real example',
        body: 'A short, concrete code snippet early beats an abstract introduction every time.',
      },
    ],
    pitfalls: [
      'Using an API token from a free account, where publishing is not available.',
      'Forgetting tags and losing the discovery that comes with them.',
      'Republishing without a canonical URL and confusing search.',
    ],
    faqs: [
      {
        q: 'Do I need a paid Hashnode plan?',
        a: 'Publishing through the API needs a Hashnode Pro account, which is where the write API is available.',
      },
      {
        q: 'Can I cross-post from my own blog?',
        a: 'Yes. Set the canonical URL to the original and the republished piece credits your site.',
      },
      {
        q: 'How many tags can I use?',
        a: 'Up to five. A few specific tags outperform a long list of broad ones.',
      },
    ],
  },
  {
    key: 'ghost',
    name: 'Ghost',
    tagline: 'Newsletters and blog posts published from the same calendar.',
    intro:
      'Ghost pairs a clean blog with a newsletter. Sosial connects over the Ghost Admin API to create and schedule posts — title, body, tags and feature image — and can send them to your subscribers as an email at the same moment.',
    limit: 100000,
    bestFor: ['Newsletters', 'Membership blogs', 'Long-form publishing with email delivery'],
    facts: [
      { label: 'Content limit', value: 'Effectively unlimited (100k+ characters)' },
      { label: 'Auth', value: 'Ghost Admin API key' },
      { label: 'Delivery', value: 'Web post, email to subscribers, or both' },
      { label: 'Media', value: 'Feature image and inline images' },
    ],
    tips: [
      {
        title: 'Decide web, email or both',
        body: 'Not every post deserves an inbox. Send to email when it matters, publish quietly to the web when it does not.',
      },
      {
        title: 'Write a subject-line-first headline',
        body: 'The headline is the email subject, so write it to earn the open, not just the click.',
      },
      {
        title: 'One idea per send',
        body: 'Focused emails hold attention. Save the roundups for a recurring digest.',
      },
    ],
    pitfalls: [
      'Blasting every update to email and burning out subscribers.',
      'Publishing without a feature image and getting a plain link card.',
      'Rotating the Admin API key without updating the connection.',
    ],
    faqs: [
      {
        q: 'Does Sosial send Ghost newsletters?',
        a: 'Yes. A scheduled post can publish to the web and email your subscribers in the same action.',
      },
      {
        q: 'How does the connection work?',
        a: 'With a Ghost Admin API key from your site Integrations settings — no plugin required.',
      },
      {
        q: 'Can I schedule posts ahead?',
        a: 'Yes. Sosial publishes or sends the post at the time you set in the calendar.',
      },
    ],
  },
  {
    key: 'vk',
    name: 'VK',
    tagline: 'Reach Russian-speaking audiences on the network they use daily.',
    intro:
      'VK is one of the largest social networks in the Russian-speaking world. Sosial posts to your community or profile through the VK API, so scheduled updates, links and media publish exactly when you plan them.',
    limit: 16384,
    bestFor: ['Russian-speaking audiences', 'Community updates', 'Links and media posts'],
    facts: [
      { label: 'Post limit', value: '16,384 characters' },
      { label: 'Media', value: 'Photos, video and links with previews' },
      { label: 'Where it posts', value: 'A community (group or public page) or your profile' },
      { label: 'Auth', value: 'VK OAuth access token' },
    ],
    tips: [
      {
        title: 'Post from the community, not your profile',
        body: 'Community posts carry the page identity and build a following rather than a personal timeline.',
      },
      {
        title: 'Let the link make its own preview',
        body: 'VK renders a rich card for shared links. Paste the URL on its own line so it expands cleanly.',
      },
      {
        title: 'Attach media for reach',
        body: 'Posts with an image stop the scroll in a way plain text cannot.',
      },
    ],
    pitfalls: [
      'Publishing from a personal profile when you meant the community.',
      'Expired access tokens after a password change on the VK account.',
      'Pasting a raw URL inside a sentence, which stops it previewing.',
    ],
    faqs: [
      {
        q: 'Can Sosial post to a VK community?',
        a: 'Yes. Connect your account and choose the community; scheduled posts publish there on time.',
      },
      {
        q: 'Does it support photos?',
        a: 'Yes. Attach an image and it publishes with the post, complete with a preview.',
      },
      {
        q: 'What about the character limit?',
        a: 'VK allows up to 16,384 characters — plenty for a full update, with counters in the composer.',
      },
    ],
  },
];

export function channelGuide(key: string): ChannelGuide | undefined {
  return CHANNEL_GUIDES.find((c) => c.key === key);
}

/** Ordered keys — used for related-channel strips. */
export const CHANNEL_KEYS = CHANNEL_GUIDES.map((c) => c.key);

export function relatedChannels(key: string, count = 3): ChannelGuide[] {
  const idx = CHANNEL_GUIDES.findIndex((c) => c.key === key);
  if (idx < 0) return CHANNEL_GUIDES.slice(0, count);
  const out: ChannelGuide[] = [];
  for (let i = 1; out.length < count && i <= CHANNEL_GUIDES.length; i++) {
    const next = CHANNEL_GUIDES[(idx + i) % CHANNEL_GUIDES.length];
    if (next.key !== key) out.push(next);
  }
  return out;
}
