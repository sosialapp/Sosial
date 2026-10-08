import type { Block } from './types';

/**
 * Web legal copy. The mobile app's `src/utils/legal.ts` describes a local-first
 * app with no accounts — that is no longer true of Sosial, which has workspaces,
 * a shared calendar and a publishing worker. These pages are the accurate
 * public version and are what the footer and signup consent link to.
 */

export interface LegalSection {
  title: string;
  blocks: Block[];
}

export interface LegalDoc {
  slug: 'terms' | 'privacy';
  title: string;
  updated: string;
  summary: string;
  sections: LegalSection[];
}

export const TERMS: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Use',
  updated: '2026-10-08',
  summary:
    'The agreement between you and Sosial for using the service: accounts, content, publishing and liability.',
  sections: [
    {
      title: '1. The service',
      blocks: [
        {
          t: 'p',
          c: 'Sosial is a social media scheduling and publishing service operated by EGATE WORLDWIDE. You connect social accounts, compose content, schedule it, and Sosial publishes it to those accounts on your behalf using each platform\'s official API.',
        },
        {
          t: 'p',
          c: 'By creating a workspace you agree to these terms. If you are using Sosial on behalf of a company, you confirm you are authorised to accept these terms for that company.',
        },
      ],
    },
    {
      title: '2. Your account',
      blocks: [
        {
          t: 'ul',
          c: [
            'You must be old enough to hold an account on each platform you connect.',
            'You are responsible for keeping your login credentials secure.',
            'You are responsible for everything published from a social account while it is connected to your workspace.',
          ],
        },
      ],
    },
    {
      title: '3. Connected platforms',
      blocks: [
        {
          t: 'p',
          c: 'Sosial publishes to 18 channels: X, Instagram, TikTok, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon, Pinterest, Telegram, Discord, WordPress, Dev.to, Hashnode, Ghost, VK and Google Business Profile. Your use of each connected platform remains governed by that platform\'s own terms and policies. Sosial accesses these accounts only to publish the content you schedule and to read the limited profile information needed to display them.',
        },
        {
          t: 'p',
          c: 'Some channels are shown as "Soon" and cannot yet be connected: Google Business Profile, LinkedIn and Pinterest. They are displayed for information only, and no account is accessed for them until they go live.',
        },
        {
          t: 'p',
          c: 'Concretely, "publishing on your behalf" means posting your scheduled text, photos and video; uploading media where a platform requires it before posting; and reading the minimum profile, delivery-status and statistics fields needed to confirm a post went out and to show you results. The exact permissions for each platform, for example posting and media upload on X, content publishing on Instagram and Threads, video upload and publishing on TikTok, Page posting on Facebook, member and Company Page posting on LinkedIn, video uploads on YouTube, board and Pin writes on Pinterest, application-password publishing on WordPress, API publishing on Dev.to and Hashnode, Admin API publishing on Ghost, and bot-based posting on Telegram and Discord, are shown by that platform on its own connect screen before you approve them. Bluesky uses a handle plus an app password instead of OAuth; the password is never stored. X requires a paid plan because its posting API is metered.',
        },
        {
          t: 'p',
          c: 'You can also connect content sources that feed the composer rather than publish to it: media from Dropbox, Canva, Unsplash and OneDrive, imports from Notion and Google Sheets, and automation tools and AI agents via Zapier and MCP using an API key you generate. These are read-only or one-way into Sosial except where you explicitly ask an agent to create a post. Google Drive and Google Photos are shown as "Soon" and are not yet connectable, pending Google\'s own verification.',
        },
        {
          t: 'p',
          c: 'If a platform changes its API, withdraws access, or suspends your account, publishing to that channel may stop. Sosial is not responsible for changes a third-party platform makes.',
        },
      ],
    },
    {
      title: '4. Your content',
      blocks: [
        {
          t: 'p',
          c: 'You keep ownership of everything you create in Sosial. You grant us the limited licence needed to store, process and publish your content to the accounts you choose.',
        },
        {
          t: 'p',
          c: 'You confirm you own or have the necessary rights to everything you publish, including images, video and text. Do not publish content that is unlawful, infringing, deceptive, or that violates a connected platform\'s rules.',
        },
      ],
    },
    {
      title: '5. Team workspaces',
      blocks: [
        {
          t: 'p',
          c: 'A workspace has an owner, and optionally admins and members. The owner is responsible for who is invited and what role they hold, for the workspace\'s payment, and for any content published from the workspace.',
        },
      ],
    },
    {
      title: '6. Availability and changes',
      blocks: [
        {
          t: 'p',
          c: 'Sosial is provided as-is and without warranties. We aim for high availability but do not guarantee uninterrupted publishing. We may modify, suspend or discontinue any part of the service, and will give reasonable notice of changes that materially affect paying customers.',
        },
      ],
    },
    {
      title: '7. Liability',
      blocks: [
        {
          t: 'p',
          c: 'To the extent permitted by law, Sosial is not liable for indirect or consequential losses, including lost reach, lost revenue, or content that failed to publish. Our total liability is limited to the amount you paid for the service in the twelve months before the claim.',
        },
      ],
    },
    {
      title: '8. Contact',
      blocks: [
        {
          t: 'p',
          c: 'Questions about these terms? Email support@sosial.app or reach us through the contact link in your workspace. EGATE WORLDWIDE operates Sosial and is fully remote — there is no physical office.',
        },
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  updated: '2026-10-08',
  summary:
    'What we store, why we store it, how it is protected, who we share it with, and how to get it out, written in plain language.',
  sections: [
    {
      title: 'What we store',
      blocks: [
        {
          t: 'ul',
          c: [
            'Account details: your email address and an encrypted password, or your OAuth identity if you signed in with a provider.',
            'Workspace data: your posts, captions, schedules, media and templates.',
            'Connected channel data: the account handle, display name and the access token needed to publish.',
            'Connected source data: for imports from Notion and Google Sheets, the page or sheet reference and the content you import; for automation tools and AI agents, an API key you generate.',
            'Billing: handled by our payment provider. We store only a customer reference, not your card number.',
          ],
        },
      ],
    },
    {
      title: 'Connected social accounts',
      blocks: [
        {
          t: 'p',
          c: 'Sosial publishes to 18 channels. When you connect one, we receive an access token from that platform and store it encrypted so the worker can publish your scheduled posts. We do not store your social media passwords. The one exception is Bluesky, which has no OAuth: you sign in with a handle and an app password that is used once and never stored. Only short-lived session tokens are kept. We do not read your private messages on any platform.',
        },
        {
          t: 'ul',
          c: [
            'X: read your profile, publish and read posts, and upload media, only for the posts you schedule. A refresh token keeps you signed in so scheduled posts can publish on time. X requires a paid plan because its posting API is metered.',
            'Instagram: read your Business or Creator profile, and publish the photos, videos and reels you schedule. We deliberately do not request insights access.',
            'TikTok: read your basic profile and video statistics, upload and publish the videos and photos you schedule, and list posted videos to confirm delivery.',
            'Facebook: list the Pages you manage, read their engagement and content, and publish the posts, photos and videos you schedule to them. Personal timelines are never touched.',
            'Threads: read your profile, publish the posts you schedule, read replies, and read insights for content published through Sosial.',
            'Bluesky: publish the posts you schedule and upload the images and video they contain, using session tokens from your sign-in.',
            'Mastodon: read and write access on the instance you choose, verify the account, publish scheduled posts and upload media. Your instance address is stored so publishing reaches the right server.',
            'LinkedIn: identify you via OpenID, publish posts as you, and read your own posts and their statistics. If you connect a Company Page you administer, the same applies to that Page.',
            'YouTube: upload videos to your channel, read the channel and video list to confirm delivery and show status, and manage comments on uploads published through Sosial.',
            'Pinterest: read your account, and read and write boards and Pins, publishing scheduled Pins to the boards you choose.',
            'WordPress: connect a self-hosted or WordPress.com site with an application password, and publish the posts you schedule to it as drafts or live.',
            'Dev.to: publish your scheduled articles and upload their cover images through the Dev.to API.',
            'Hashnode: publish your scheduled articles to a publication you own through Hashnode.',
            'Ghost: publish your scheduled posts to a Ghost site through its Admin API.',
            'Telegram: send your scheduled messages and media to a channel or group you administer through a bot you authorise.',
            'Discord: post your scheduled messages and media to a server channel through a bot you authorise.',
            'VK: publish your scheduled posts and media to your VK profile or community.',
            'Google Business Profile: publish your scheduled posts to a location you manage. This channel is listed as "Soon" and is not yet connectable.',
          ],
        },
        {
          t: 'p',
          c: 'A small number of the channels we list are shown as "Soon" and cannot be connected yet: Google Business Profile, LinkedIn and Pinterest. They appear in the product so you can see what is coming, but no data is collected for them until they go live.',
        },
        {
          t: 'p',
          c: 'You can disconnect a channel at any time from the Channels screen, which deletes the stored token. You can also revoke Sosial\'s access directly from the connected platform\'s settings. Doing so immediately stops publishing to that channel.',
        },
      ],
    },
    {
      title: 'Connected media sources',
      blocks: [
        {
          t: 'p',
          c: 'When you attach photos or videos from a connected source, the app lists your files or designs so you can pick one, downloads only the file you choose, and attaches it to your post. For Google Photos, picking happens inside Google\u2019s own picker interface, and only the photos you select are ever shared with the app. Access is read-only: Sosial never uploads, edits, moves, shares or deletes anything in your cloud storage or design library. Unsplash photos automatically carry the photographer\u2019s name and profile link in your caption, as their license requires.',
        },
        {
          t: 'p',
          c: 'These media and content sources are live today:',
        },
        {
          t: 'ul',
          c: [
            'Dropbox: list your folders and files and download only the file you choose.',
            'Canva: list your designs and download the export you choose.',
            'Unsplash: search the photo library and attach the photo you choose, with its required credit.',
            'OneDrive: list your folders and files and download only the file you choose.',
            'Notion: import pages you have shared with the Sosial integration and turn them into drafts. Import is one-way, from Notion into Sosial.',
            'Google Sheets: import rows from a sheet you share with Sosial and turn them into scheduled posts. Import is one-way, from Sheets into Sosial.',
            'Zapier and MCP: connect automation tools and AI agents that create posts in your workspace through the Sosial API and Model Context Protocol, using an API key you generate and can revoke at any time.',
          ],
        },
        {
          t: 'p',
          c: 'Google Drive and Google Photos are listed as "Soon" and are not yet connectable, because the restricted Google scopes they need are pending Google\'s verification and CASA assessment. No Google Drive or Google Photos data is accessed until they go live.',
        },
        {
          t: 'p',
          c: 'Access tokens for cloud drive sources are kept on your own device (your phone\u2019s secure storage, or your browser\u2019s local storage on the web) and are never stored on our servers. Sosial-side secrets and service credentials used for imports live server-side and are never shipped to the app. Disconnecting a source in the app deletes its tokens from your device immediately.',
        },
      ],
    },
    {
      title: 'How we use it',
      blocks: [
        {
          t: 'ul',
          c: [
            'To publish the posts you schedule, at the times you choose.',
            'To show your calendar, queue and per-channel results.',
            'To operate your subscription and provide support.',
            'To send essential service email: sign-in links, invites and account notices.',
          ],
        },
        {
          t: 'p',
          c: 'We do not sell your data, we do not use your content to train AI models, and we do not use Google user data to serve advertisements. Sosial\'s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.',
        },
      ],
    },
    {
      title: 'The AI writer',
      blocks: [
        {
          t: 'p',
          c: 'When you use the AI writer, the brief you submit is sent to the configured AI provider to generate a draft, and the result is returned to your workspace. We do not use your briefs or drafts to train models. If you enable web research for a post, the writer performs a live search to ground the copy and returns the sources it used.',
        },
      ],
    },
    {
      title: 'Where it lives',
      blocks: [
        {
          t: 'p',
          c: 'Your data is stored in our database and object storage providers, encrypted in transit and at rest. Access is restricted to the systems that need it to run the service.',
        },
      ],
    },
    {
      title: 'How we protect it',
      blocks: [
        {
          t: 'p',
          c: 'We apply technical and organisational safeguards to Google user data and to all other personal data we handle:',
        },
        {
          t: 'ul',
          c: [
            'Encryption in transit: every connection between your device, our servers and Google uses TLS/HTTPS. Google API traffic uses Google\'s required TLS (minimum 1.2).',
            'Encryption at rest: data is encrypted at rest in our database, object storage and backups, using AES-256 or the provider\'s equivalent.',
            'Access tokens: OAuth access and refresh tokens for connected accounts are encrypted before storage (AES-256-GCM with a server-held key held in our secrets manager). They are decrypted only by the publishing worker, only at publish time, and are never shown in the app or written to logs.',
            'Least privilege: we request only the Google scopes a feature needs, we employ the narrowest practical scope, and we do not request access you do not use.',
            'Access control: internal access to production systems is limited to the personnel who operate the service, is protected by multi-factor authentication, and is logged. There is no public or unauthenticated access to user data.',
            'Token minimization: Google Photos are accessed through Google\'s own picker and only the photos you select are read; Google Drive is read-only. We never store your Google password, and we store no Google data beyond the fields needed to publish and display your account.',
            'Key management: encryption keys are stored in a managed secrets service, are not committed to source control, and are rotated on a schedule and on staff departure.',
            'Retention and secure deletion: tokens are deleted when you disconnect a channel; your data is deleted when you delete your workspace, and residual copies in backups expire on a rolling schedule.',
            'Incident response: we monitor for anomalies, restrict and revoke compromised credentials, and will notify affected users and Google without undue delay if a breach affects their data.',
          ],
        },
      ],
    },
    {
      title: 'Who we share it with',
      blocks: [
        {
          t: 'p',
          c: 'We do not sell Google user data, and we do not use or transfer Google user data for advertising, for serving ads, or for training or improving generalised AI or machine-learning models. We do not allow humans to read your Google data unless you ask us to for support, it is necessary for security or to comply with law, or the data has been aggregated and anonymised.',
        },
        {
          t: 'p',
          c: 'We share data only with the parties needed to run the service you asked for, under contract and only as described here:',
        },
        {
          t: 'ul',
          c: [
            'The social platforms you connect: we send your post content and media to each platform\'s official API so it can publish on your behalf. This is the whole point of the feature and happens only for the posts you schedule and the channels you choose.',
            'Cloud infrastructure and storage subprocessors: our database, object storage, hosting and email providers, which host the service and hold data under our instructions. They are contractually bound to protect it and may not use it for their own purposes.',
            'AI writer provider: when you use the AI writer, the brief you submit is sent to the configured AI provider to generate a draft. Google user data is never included unless you put it in the brief yourself.',
            'Payment provider: our billing provider processes your subscription. We share a customer and subscription reference; we never receive or store your full card number.',
            'Legal and safety: we may disclose data if required by law, to enforce our terms, or to protect the rights, safety and security of our users and the public. Where lawful, we will tell you first.',
          ],
        },
        {
          t: 'p',
          c: 'We do not transfer Google user data to third parties for purposes other than those listed above.',
        },
      ],
    },
    {
      title: 'How long we keep it',
      blocks: [
        {
          t: 'p',
          c: 'We keep your workspace data while your account is active. If you delete your workspace, we remove your content, connected tokens and personal details. Some records may be retained briefly for legal, tax or security reasons.',
        },
      ],
    },
    {
      title: 'Your choices',
      blocks: [
        {
          t: 'ul',
          c: [
            'Access and export: you can review everything in your workspace and export your content at any time.',
            'Correction: you can edit or delete any post, draft or connected channel.',
            'Deletion: you can delete your workspace, which removes your data as described above. [Request deletion](/delete-data).',
          ],
        },
      ],
    },
    {
      title: 'Cookies',
      blocks: [
        {
          t: 'p',
          c: 'We use a single essential cookie to keep you signed in. Sosial does not embed advertising trackers or third-party analytics that follow you across the web.',
        },
      ],
    },
    {
      title: 'Children',
      blocks: [
        {
          t: 'p',
          c: 'Sosial is a business tool and is not directed at children. We do not knowingly collect data from anyone below the minimum age required to hold a social media account in their jurisdiction.',
        },
      ],
    },
    {
      title: 'Changes and contact',
      blocks: [
        {
          t: 'p',
          c: 'If this policy changes materially we will tell you in the product before the change takes effect. Questions? Email support@sosial.app or use the contact link in your workspace. The data controller is EGATE WORLDWIDE, the operator of Sosial.',
        },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<'terms' | 'privacy', LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
};
