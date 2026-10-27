/**
 * Single home for the app's legal copy. The pre-login consent sheet, the
 * Account → Terms view and the Privacy Policy screen all render from here
 * so the words can never drift apart.
 *
 * Sosial is no longer a local-only studio: it has workspaces, a shared
 * calendar and a publishing worker, so the app copy mirrors the public
 * web pages (apps/web/src/content/legal.ts) rather than the old local-first
 * description.
 */

export const TERMS_TEXT =
  'Sosial is a social media scheduling and publishing service operated by EGATE WORLDWIDE. You connect social accounts, compose content, schedule it, and Sosial publishes it to those accounts on your behalf using each platform’s official API. By creating a workspace you agree to these terms.\n\n' +
  'You must be old enough to hold an account on each platform you connect, you are responsible for keeping your login credentials secure, and for everything published from a social account while it is connected to your workspace.\n\n' +
  'Sosial publishes to 18 channels: X, Instagram, TikTok, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon, Pinterest, Telegram, Discord, WordPress, Dev.to, Hashnode, Ghost, VK and Google Business Profile. Sixteen are live today; LinkedIn and Google Business Profile are in preview and light up once the platform approves our access. Your use of each connected platform remains governed by that platform’s own terms and policies. X requires a paid plan because its posting API is metered.\n\n' +
  'You keep ownership of everything you create, and full responsibility for it. Do not publish content you do not own or have rights to, or that is unlawful, infringing or deceptive. Sosial does not review posts before they go out and is not liable for what you publish: racist, hateful, sexually explicit, defamatory or misleading content, political content, misinformation, or anything else that breaks the law or a platform’s rules. Legal trouble from your posts is yours, not ours. We may remove content or suspend accounts that break these terms or the law.\n\n' +
  'Some channels also let you read and answer messages and comments in Sosial: direct messages on Facebook Pages (Messenger), Instagram, X, Mastodon and Bluesky, and comments on Facebook, Instagram, Threads, X, Mastodon, Bluesky and YouTube. You are responsible for what you send and for each platform’s messaging rules.\n\n' +
  'In a shared workspace the owner decides who is invited and what role they hold, and members can be required to submit posts for approval. A member’s post goes to the Approvals queue and an owner or admin must approve it before it publishes; whoever approves takes responsibility for that decision.\n\n' +
  'Marketing emails (product news and tips) are sent only to users who opt in via the optional checkbox at signup or a preference in account settings. Every marketing email carries a one-click unsubscribe link, and unsubscribing takes effect immediately. Operational emails such as security notices, receipts and publishing confirmations are not marketing and continue regardless.\n\n' +
  'Accounts with no sign-in and no activity for six consecutive months may be deleted along with all their data. We email a reminder one month before any such deletion, and signing in at any point during that month cancels it. A shared workspace is only deleted once every member has been inactive: activity by any teammate keeps the workspace and its data. Accounts with an active paid subscription are never deleted for inactivity.\n\n' +
  'Sosial is provided as-is, without warranties, and our total liability is limited to the amount you paid in the twelve months before a claim.\n\n' +
  'You can also pull content in from Dropbox, Canva, Unsplash and OneDrive (read-only: Sosial never changes or deletes anything in your storage), import drafts from Notion and Google Sheets, and let your own automations post through Zapier or MCP with an API key you control. AI features — the writer, per-channel captions, and blog and studio drafts — send your brief to OpenAI to generate a result; we never use your inputs to train models, and you should review AI output before publishing.\n\n' +
  'You can delete your workspace at any time, which removes your content, credentials and personal details. Inactive accounts may be deleted as described above. Cancel any paid subscription first: deletion does not cancel billing.';

export interface LegalSection {
  title: string;
  body: string;
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'What we store',
    body: 'Your email address and an encrypted password (or your OAuth identity if you signed in with a provider); workspace data — posts, captions, schedules, media, templates, the approval status and review history of each post, and the roles of the people in the workspace; the handle, display name and publishing credential for each connected channel; the messages and comments we read for the channels where you use the inbox; a push token for each device where you enabled notifications; import references for Notion and Google Sheets plus any API keys you generate for automation tools and AI agents. Billing is handled by Stripe on the web and, where offered, by the app store you purchased from. We store a customer and subscription reference, never your card number.',
  },
  {
    title: 'Connected social accounts',
    body: 'Sosial publishes to 18 channels. When you connect one, we receive a credential from that platform and store it encrypted so the worker can publish your scheduled posts. For OAuth platforms that is an access token plus a refresh token; for WordPress, Telegram, Discord and Ghost it is an application password, bot token or API key; for Bluesky it is a handle plus an app password. We do not store your social media passwords anywhere else. Bluesky has no OAuth, so its app password is the one password-shaped credential we keep: encrypted in our vault and in your device’s secure storage, never shown back to you or written to logs, and used only to mint short-lived sessions for publishing. LinkedIn and Google Business Profile are in preview and are not connectable yet, so no data is collected for them. Connect and disconnect any channel from the Channels screen; disconnecting deletes the stored credential and pauses publishing to it. A separate Delete data action erases the posts, stats, comments and messages we stored for that channel.',
  },
  {
    title: 'Messages & comments',
    body: 'If you use the inbox or comments features, we read the direct messages and comments that arrive on the channels you connect, so they can be shown in one place and answered from Sosial. That covers direct messages on Facebook Pages (Messenger), Instagram, X, Mastodon and Bluesky, and comments on Facebook, Instagram, Threads, X, Mastodon, Bluesky and YouTube. We store the participant’s name and avatar, the text, attachments, direction, timestamp and delivery status; for comments, the author, the text, the post it belongs to and whether you replied to it. We do not sell this data, do not use it for advertising and do not use it to train models. Disconnecting a channel stops new reads but leaves what was already synced until you choose Delete data for that channel.',
  },
  {
    title: 'Notifications',
    body: 'If you enable push notifications, your device registers an Expo push token. We store it against your user and workspace, with the device platform, so the worker can tell you when a post publishes, fails or needs approval, and when your team changes. Delivery runs through Expo’s push service, and the alert text can contain a post title or a teammate’s name. You can turn notifications off in the app or in device settings; the token is deleted when you delete your account.',
  },
  {
    title: 'Connected media & content sources',
    body: 'Live sources are Dropbox, Canva, Unsplash and OneDrive for media; Notion and Google Sheets for one-way imports into drafts; and Zapier and MCP so automation tools and AI agents can create posts with an API key you control. When you attach from a media source, the app lists your files or designs so you can pick one, downloads only the file you choose, and attaches it. Access is read-only: Sosial never uploads, edits, moves, shares or deletes anything in your cloud storage or design library. Unsplash photos carry the photographer’s credit automatically. Google Drive and Google Photos are shown as "Soon" and are not yet connectable, pending Google’s own verification.',
  },
  {
    title: 'Content responsibility',
    body: 'What you publish through Sosial is yours: we store and deliver it on your behalf, but we do not review it and we are not responsible for it. If your content is racist, hateful, sexually explicit, defamatory, misleading or unlawful (including political content or misinformation), any legal consequences fall on you, not on Sosial.',
  },
  {
    title: 'Where your credentials live',
    body: 'Connected channel credentials are encrypted before they reach our vault (AES-256-GCM) and are decrypted only by the publishing worker or inbox sync when a request needs them. They are never shown back in the app or written to logs. Access tokens for cloud drive sources are kept in your device’s secure storage only and are never sent to our servers. Disconnecting a source or channel deletes its credentials immediately.',
  },
  {
    title: 'How we use it',
    body: 'To publish the posts you schedule at the times you choose; to show your calendar, queue, inbox, comments and per-channel results; to route posts through approvals and notify the right teammates; to deliver push notifications to devices where you enabled them; to operate your subscription and provide support; and to send essential service email like sign-in links, invites and account notices. We do not sell your data, we do not use your content to train AI models, and we do not use Google user data to serve advertisements.',
  },
  {
    title: 'The AI features',
    body: 'When you use an AI feature — the writer, per-channel captions, or the blog and studio drafts — the brief and any material you point it at are sent to OpenAI, our AI provider, and the result returns to your workspace. We do not use your briefs, inputs or drafts to train models, and OpenAI does not train on data submitted through its API. If you enable web research for a post, the writer performs a live search and returns the sources it used. AI output can be wrong or incomplete, so review it before publishing.',
  },
  {
    title: 'How we protect it',
    body: 'Data is encrypted in transit (TLS 1.2+) and at rest (AES-256 or equivalent). Channel credentials — OAuth tokens, WordPress application passwords, bot tokens, API keys and the Bluesky app password — are encrypted with AES-256-GCM before storage, decrypted only when a request needs them, and never shown in the app or written to logs. We request the narrowest scope a feature needs, gate internal production access behind multi-factor authentication and logging, keep encryption keys in a managed secrets service, and delete credentials when you disconnect a channel and your data when you delete your workspace.',
  },
  {
    title: 'Who we share it with',
    body: 'Only the parties needed to run the service: the social platforms you connect (so they can publish on your behalf and answer the inbox reads you ask for), our infrastructure providers — Supabase (database, authentication, storage), Vercel (web hosting), Railway (publishing worker) and Expo (push delivery) — OpenAI for the AI inputs you submit, Stripe and the app stores for billing, and the source tools you connect (Dropbox, Canva, Unsplash, OneDrive, Notion, Google Sheets, Zapier, MCP). We may disclose data if required by law or to protect rights and safety, and where lawful we will tell you first. We do not sell your data or transfer it for advertising.',
  },
  {
    title: 'Analytics & tracking',
    body: 'Sosial collects no advertising analytics, shows no ads, and embeds no third-party trackers that follow you across apps or the web.',
  },
  {
    title: 'Marketing emails',
    body: 'Product news and tips are sent only to people who asked for them, via the optional checkbox at signup or a preference in account settings. Consent is stored as a flag on your account, the emails come from our own domain, and every one carries a one-click unsubscribe link that takes effect immediately. We do not share your email address with advertising networks, and unsubscribing from marketing never affects operational emails such as security notices, receipts or publishing confirmations.',
  },
  {
    title: 'How long we keep it',
    body: 'We keep your workspace data while your account is active, and delete it when you delete your workspace. If an account is inactive for six consecutive months (no sign-in and no activity), it and all of its data are deleted; we email a reminder one month before, and signing in at any point cancels the deletion. A shared workspace is only deleted once every member has been inactive: activity by any teammate keeps it and its data. Accounts with an active paid subscription are never deleted for inactivity. Support tickets and their screenshots are erased 30 days after the ticket is resolved.',
  },
  {
    title: 'Children',
    body: 'Sosial is a business tool and is not directed at children. We do not knowingly collect data from anyone below the minimum age required to hold a social media account in their jurisdiction.',
  },
  {
    title: 'Changes & contact',
    body: 'If anything important changes here, we will tell you in the product first. Questions about your data? Email support@sosial.app. The data controller is EGATE WORLDWIDE.',
  },
];
