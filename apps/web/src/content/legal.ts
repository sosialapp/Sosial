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
  updated: '2026-09-01',
  summary:
    'The agreement between you and Sosial for using the service: accounts, content, publishing and liability.',
  sections: [
    {
      title: '1. The service',
      blocks: [
        {
          t: 'p',
          c: 'Sosial is a social media scheduling and publishing service. You connect social accounts, compose content, schedule it, and Sosial publishes it to those accounts on your behalf using each platform\'s official API.',
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
          c: 'Your use of each connected platform, X, Instagram, TikTok, Facebook, Threads, Bluesky, Mastodon, LinkedIn, YouTube and Pinterest, remains governed by that platform\'s own terms and policies. Sosial accesses these accounts only to publish the content you schedule and to read the limited profile information needed to display them.',
        },
        {
          t: 'p',
          c: 'Concretely, "publishing on your behalf" means posting your scheduled text, photos and video; uploading media where a platform requires it before posting; and reading the minimum profile, delivery-status and statistics fields needed to confirm a post went out and to show you results. The exact permissions for each platform, for example posting and media upload on X, content publishing on Instagram and Threads, video upload and publishing on TikTok, Page posting on Facebook, member and Company Page posting on LinkedIn, video uploads on YouTube, board and Pin writes on Pinterest, and read-write access on your chosen Mastodon instance, are shown by that platform on its own connect screen before you approve them. Bluesky uses a handle plus an app password instead of OAuth; the password is never stored.',
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
          c: 'Questions about these terms? Reach us through the contact link in your workspace.',
        },
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  updated: '2026-09-01',
  summary:
    'What we store, why we store it, and how to get it out, written in plain language.',
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
          c: 'When you connect a social account, we receive an access token from that platform and store it encrypted so the worker can publish your scheduled posts. We do not store your social media passwords. The one exception is Bluesky, which has no OAuth: you sign in with a handle and an app password that is used once and never stored. Only short-lived session tokens are kept. We do not read your private messages on any platform.',
        },
        {
          t: 'ul',
          c: [
            'X: read your profile, publish and read posts, and upload media, only for the posts you schedule. A refresh token keeps you signed in so scheduled posts can publish on time.',
            'Instagram: read your Business or Creator profile, and publish the photos, videos and reels you schedule. We deliberately do not request insights access.',
            'TikTok: read your basic profile and video statistics, upload and publish the videos and photos you schedule, and list posted videos to confirm delivery.',
            'Facebook: list the Pages you manage, read their engagement and content, and publish the posts, photos and videos you schedule to them. Personal timelines are never touched.',
            'Threads: read your profile, publish the posts you schedule, read replies, and read insights for content published through Sosial.',
            'Bluesky: publish the posts you schedule and upload the images and video they contain, using session tokens from your sign-in.',
            'Mastodon: read and write access on the instance you choose, verify the account, publish scheduled posts and upload media. Your instance address is stored so publishing reaches the right server.',
            'LinkedIn: identify you via OpenID, publish posts as you, and read your own posts and their statistics. If you connect a Company Page you administer, the same applies to that Page.',
            'YouTube: upload videos to your channel, read the channel and video list to confirm delivery and show status, and manage comments on uploads published through Sosial.',
            'Pinterest: read your account, and read and write boards and Pins, publishing scheduled Pins to the boards you choose.',
          ],
        },
        {
          t: 'p',
          c: 'You can disconnect a channel at any time from the Channels screen, which deletes the stored token. You can also revoke Sosial\'s access directly from the connected platform\'s settings. Doing so immediately stops publishing to that channel.',
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
          c: 'We do not sell your data and we do not use your content to train AI models.',
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
            'Deletion: you can delete your workspace, which removes your data as described above.',
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
          c: 'If this policy changes materially we will tell you in the product before the change takes effect. Questions? Use the contact link in your workspace.',
        },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<'terms' | 'privacy', LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
};
