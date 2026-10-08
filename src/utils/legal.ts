/**
 * Single home for the app's legal copy — the pre-login consent sheet, the
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
  'Your use of each connected platform — X, Instagram, TikTok, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon, Pinterest, Telegram, Discord, WordPress, Dev.to, Hashnode, Ghost, VK and Google Business Profile — remains governed by that platform’s own terms and policies. Some channels are shown as "Soon" and cannot yet be connected (Google Business Profile, LinkedIn, Pinterest). X requires a paid plan.\n\n' +
  'You keep ownership of everything you create. Do not publish content you do not own or have rights to, or that is unlawful, infringing or deceptive.\n\n' +
  'Sosial is provided as-is, without warranties, and our total liability is limited to the amount you paid in the twelve months before a claim.';

export interface LegalSection {
  title: string;
  body: string;
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'What we store',
    body: 'Your email address and an encrypted password (or your OAuth identity if you signed in with a provider); your workspace data — posts, captions, schedules, media and templates; your connected channel handles, display names and the access token needed to publish; and import references for Notion and Google Sheets plus any API keys you generate for automation tools and AI agents. Billing is handled by our payment provider — we store only a customer reference, never your card number.',
  },
  {
    title: 'Connected social accounts',
    body: 'Sosial publishes to 18 channels. When you connect one, we receive an access token from that platform and store it encrypted so the worker can publish your scheduled posts. We never store your social media passwords. The one exception is Bluesky, which has no OAuth: you sign in with a handle and an app password that is used once and never stored. We do not read your private messages on any platform. Some channels are shown as "Soon" and cannot yet be connected — Google Business Profile, LinkedIn and Pinterest — and no account is accessed for them until they go live. Connect and disconnect any channel from the Channels screen; disconnecting deletes the stored token.',
  },
  {
    title: 'Connected media & content sources',
    body: 'Live sources are Dropbox, Canva, Unsplash and OneDrive for media; Notion and Google Sheets for one-way imports into drafts; and Zapier and MCP so automation tools and AI agents can create posts with an API key you control. When you attach from a media source, the app lists your files or designs so you can pick one, downloads only the file you choose, and attaches it. Access is read-only: Sosial never uploads, edits, moves, shares or deletes anything in your cloud storage or design library. Unsplash photos carry the photographer’s credit automatically. Google Drive and Google Photos are shown as "Soon" and are not yet connectable, pending Google’s own verification.',
  },
  {
    title: 'Where your tokens live',
    body: 'Access tokens for cloud drive sources are kept in your device’s secure storage only and are never sent to our servers. Sosial-side service credentials used for imports and publishing live server-side and are never shipped to the app. Disconnecting a source in the app deletes its tokens immediately.',
  },
  {
    title: 'How we use it',
    body: 'To publish the posts you schedule at the times you choose; to show your calendar, queue and per-channel results; to operate your subscription and provide support; and to send essential service email like sign-in links, invites and account notices. We do not sell your data, we do not use your content to train AI models, and we do not use Google user data to serve advertisements.',
  },
  {
    title: 'The AI writer',
    body: 'When you use the AI writer, the brief you submit is sent to the configured AI provider to generate a draft, and the result returns to your workspace. We do not use your briefs or drafts to train models. If you enable web research for a post, the writer performs a live search and returns the sources it used.',
  },
  {
    title: 'How we protect it',
    body: 'Data is encrypted in transit (TLS 1.2+) and at rest (AES-256 or equivalent). OAuth access and refresh tokens are encrypted with AES-256-GCM before storage, decrypted only by the publishing worker at publish time, and never shown in the app or written to logs. We request the narrowest scope a feature needs, gate internal production access behind multi-factor authentication and logging, keep encryption keys in a managed secrets service, and delete tokens when you disconnect a channel and your data when you delete your workspace.',
  },
  {
    title: 'Who we share it with',
    body: 'Only the parties needed to run the service: the social platforms you connect (so they can publish on your behalf), our cloud infrastructure and storage subprocessors, the AI writer provider (for the brief you submit), and our payment provider. We may disclose data if required by law or to protect rights and safety, and where lawful we will tell you first. We do not sell your data or transfer it for advertising.',
  },
  {
    title: 'Analytics & tracking',
    body: 'Sosial collects no advertising analytics, shows no ads, and embeds no third-party trackers that follow you across apps or the web.',
  },
  {
    title: 'Children',
    body: 'Sosial is a business tool and is not directed at children. We do not knowingly collect data from anyone below the minimum age required to hold a social media account in their jurisdiction.',
  },
  {
    title: 'Changes & contact',
    body: 'If this policy changes materially we will tell you in the product before the change takes effect. Questions? Email support@sosial.app. The data controller is EGATE WORLDWIDE, the operator of Sosial.',
  },
];
