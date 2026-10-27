/**
 * Single home for the app's legal copy. The pre-login consent sheet, the
 * Account → Terms view and the Privacy Policy screen all render from here
 * so the words can never drift apart.
 *
 * This is the short form of the public web pages
 * (apps/web/src/content/legal.ts). Keep the facts in step with those.
 */

export const LEGAL_UPDATED = '27 October 2026';

export const TERMS_TEXT =
  'Sosial is a tool for planning, writing and publishing social media posts, run by EGATE WORLDWIDE. You connect your social accounts, write and schedule posts, and Sosial publishes them for you through each platform’s official API. By creating an account or a workspace, you agree to these terms.\n\n' +
  'You need to be old enough to have an account on every platform you connect. Keep your login safe, because you are responsible for what happens under it and for everything published from an account while it is connected to your workspace.\n\n' +
  'Sosial works with 18 channels: X, Instagram, TikTok, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon, Pinterest, Telegram, Discord, WordPress, Dev.to, Hashnode, Ghost, VK and Google Business Profile. Sixteen are live. LinkedIn and Google Business Profile are marked "Soon" until those companies approve our access. Each platform has its own rules, and you have to follow them. X needs a paid Sosial plan because X charges for its posting API.\n\n' +
  'What you create belongs to you, and so does the responsibility for it. Only publish things you own or have the right to use. We do not check posts before they go out, so if a post is hateful, explicit, defamatory, misleading or illegal, the consequences are yours, not Sosial’s. We can remove content or close accounts that break these terms or the law.\n\n' +
  'On some channels you can answer direct messages and comments inside Sosial (direct messages on Facebook Pages, Instagram, X, Mastodon and Bluesky, and comments on Facebook, Instagram, Threads, X, Mastodon, Bluesky and YouTube). Replies go out from your own account. Nothing is sent unless you write it and press send, and you are responsible for what you send.\n\n' +
  'In a shared workspace, the owner decides who joins and what role they get. Members can be asked to send posts for approval, and an owner or admin then approves them before they publish. Whoever approves a post shares responsibility for it.\n\n' +
  'You can bring media in from Dropbox, Canva, Unsplash and OneDrive (we only download the file you pick and never change anything in your storage), import drafts from Notion and Google Sheets, and let your own automations post through Zapier or MCP with an API key you control. The AI writer sends your brief to OpenAI to write a draft. We never train AI on what you send, and you should read the result before you post it.\n\n' +
  'We only send product news if you opt in, and every email has an unsubscribe link that works right away. Account emails, like security alerts and receipts, keep coming either way.\n\n' +
  'If nobody signs in for six months, we may delete the account and its data. We email you a month before, and signing in stops it. Shared workspaces stay while any member is active, and paid accounts are never deleted for inactivity.\n\n' +
  'We work hard to keep Sosial running, but it is provided "as is", without warranties. If we are ever liable for something, the most we will pay is what you paid us in the 12 months before the claim.\n\n' +
  'You can delete your workspace at any time, which removes your content, connected accounts and personal details. Deleting does not cancel billing, so cancel any paid plan first. Questions? Email support@sosial.app.';

export interface LegalSection {
  title: string;
  body: string;
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'What we collect',
    body: 'Your email address and a password (stored encrypted), or the account you signed in with. Your workspace: posts, captions, schedules, media, templates, approvals and your team’s roles. For each connected channel, its name, handle and the key that lets us publish for you. The messages and comments we load for channels where you use the inbox. A push token for each device where you turned notifications on. The Notion pages and Google Sheets you import from, and any API keys you create. Stripe or the app store handles payments, so we only keep a subscription reference and never see your card number.',
  },
  {
    title: 'Your connected social accounts',
    body: 'When you connect a channel, the platform gives us a key so we can publish your scheduled posts. For most platforms that is a login token. For WordPress, Telegram, Discord and Ghost it is an app password, bot token or API key. For Bluesky it is your handle and an app password, which we keep encrypted and only use to start short publishing sessions. We never see the password you use to log in to a social network. LinkedIn and Google Business Profile cannot be connected yet, so we collect nothing for them. Disconnecting a channel on the Channels screen deletes its key and stops publishing, and Delete data also removes the posts, stats, comments and messages we saved for it.',
  },
  {
    title: 'Messages and comments',
    body: 'If you use the inbox, we load the direct messages and comments that arrive on your connected channels so you can answer them in one place. That covers direct messages on Facebook Pages, Instagram, X, Mastodon and Bluesky, and comments on Facebook, Instagram, Threads, X, Mastodon, Bluesky and YouTube. We save the other person’s name and profile picture, what was written, attachments and the time, and for comments the post they belong to and whether you replied. We never sell this, use it for ads or train AI on it. It stays until you use Delete data for that channel or delete your workspace.',
  },
  {
    title: 'Notifications',
    body: 'If you turn on notifications, your phone gets a push token from Expo, which delivers them for us. We use it to tell you when a post goes out, fails or needs approval, or when your team changes. A notification can show a post title or a teammate’s name on your lock screen. You can turn notifications off in the app or in your phone’s settings, and the token is deleted when you delete your account.',
  },
  {
    title: 'Media and import sources',
    body: 'Dropbox, OneDrive and Canva let you browse your files and pick one, and we download only that file. Unsplash photos come with the photographer’s credit added to your caption. Notion and Google Sheets imports only go one way, into Sosial. Zapier and AI agents can create posts with an API key you make and can delete. We never change, move, share or delete anything in your accounts, and login tokens for these sources stay on your phone. Google Drive and Google Photos are marked "Soon" while Google reviews our access.',
  },
  {
    title: 'How we use your data',
    body: 'To publish your posts at the times you set, show your calendar, queue, inbox and results, run approvals, send the notifications and account emails you need, and handle your subscription and support. We do not sell your data, we do not train AI on your content, and we do not use Google user data for ads.',
  },
  {
    title: 'AI features',
    body: 'When you use the writer, channel captions, or blog and studio drafts, your brief and the material you chose go to OpenAI, and the result comes back to your workspace. Neither we nor OpenAI train AI on it. If you turn on web research, the writer searches the web and shows its sources. AI can make mistakes, so check the result before you publish.',
  },
  {
    title: 'Who else sees your data',
    body: 'Only the companies we need to run Sosial: the social platforms you connect; Supabase (database and sign-in); Cloudflare (media storage); Vercel (website); the hosting providers that run our publishing worker; Expo (push notifications); Resend (email); OpenAI (AI features); Stripe and the app stores (payments); and the import sources you connect, only to fetch what you pick. They can only use your data to provide their service to us. We may share data if the law requires it, and where we can, we will tell you first.',
  },
  {
    title: 'How we keep it safe',
    body: 'Everything travels over HTTPS, and our database, storage and backups are encrypted. Channel keys and app passwords are encrypted with AES-256-GCM before they are saved, only unlocked when we need to publish or load your inbox, and never shown in the app or written to logs. We ask platforms for the fewest permissions each feature needs, and only the people who run Sosial can reach our systems, with two-factor sign-in.',
  },
  {
    title: 'How long we keep it',
    body: 'We keep your data while your account is active and delete it when you delete your workspace. Accounts with no sign-ins for six months are deleted with their data, after a reminder email a month before. Shared workspaces stay while any member is active, and paid accounts are never deleted for inactivity. Support tickets and their screenshots are deleted 30 days after the ticket is closed.',
  },
  {
    title: 'Tracking and emails',
    body: 'There are no ads, no ad trackers and no third-party analytics following you. We only send product news if you ask for it, every email has an unsubscribe link, and we never give your email address to advertisers.',
  },
  {
    title: 'Children',
    body: 'Sosial is a work tool and is not meant for children. We do not knowingly collect data from anyone too young to have a social media account where they live.',
  },
  {
    title: 'Changes and contact',
    body: 'If we make an important change, we will tell you in the app first. Questions about your data? Email support@sosial.app. EGATE WORLDWIDE is responsible for your data under this policy.',
  },
];
