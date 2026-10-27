import type { Block } from './types';

/**
 * Web legal copy. The mobile app's `src/utils/legal.ts` describes a local-first
 * app with no accounts. That is no longer true of Sosial, which has workspaces,
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
  updated: '2026-10-27',
  summary:
    'The rules for using Sosial: your account, your content, the platforms you connect, and what we are and are not responsible for.',
  sections: [
    {
      title: '1. Who we are',
      blocks: [
        {
          t: 'p',
          c: 'Sosial is a tool for planning, writing and publishing social media posts. It is run by EGATE WORLDWIDE. You connect your social accounts, write and schedule posts, and Sosial publishes them for you through each platform\'s official API.',
        },
        {
          t: 'p',
          c: 'By creating an account or a workspace, you agree to these terms. If you sign up for a company, you are telling us you are allowed to accept them on its behalf.',
        },
      ],
    },
    {
      title: '2. Your account',
      blocks: [
        {
          t: 'ul',
          c: [
            'You need to be old enough to have an account on every platform you connect.',
            'Keep your login safe. You are responsible for what happens under it.',
            'You are responsible for everything published from a social account while it is connected to your workspace.',
          ],
        },
      ],
    },
    {
      title: '3. Platforms you connect',
      blocks: [
        {
          t: 'p',
          c: 'Sosial works with 18 channels: X, Instagram, TikTok, Facebook, Threads, YouTube, LinkedIn, Bluesky, Mastodon, Pinterest, Telegram, Discord, WordPress, Dev.to, Hashnode, Ghost, VK and Google Business Profile. Sixteen are live. LinkedIn and Google Business Profile are marked "Soon" while we wait for those companies to approve our access, and nothing is connected for them until they go live.',
        },
        {
          t: 'p',
          c: 'Each platform still has its own rules, and you have to follow them. We only use a connected account to publish what you schedule, to load the messages and comments you open in the inbox, and to read the profile and statistics we need to show your results. Each platform shows you exactly what it is giving us on its own approval screen before you say yes.',
        },
        {
          t: 'p',
          c: 'Bluesky works differently from the rest: it uses your handle and an app password instead of a login screen. We keep that app password encrypted and only use it to start short sessions for publishing. X needs a paid Sosial plan because X charges for its posting API.',
        },
        {
          t: 'p',
          c: 'If a platform changes its API, cuts off access or suspends your account there, publishing to that channel can stop. That is outside our control.',
        },
      ],
    },
    {
      title: '4. Your content',
      blocks: [
        {
          t: 'p',
          c: 'What you create in Sosial belongs to you. You give us only the permission we need to store it, process it and publish it to the accounts you pick.',
        },
        {
          t: 'p',
          c: 'Only publish things you own or have the right to use, including photos, video and text. Do not use Sosial for anything illegal, infringing or deceptive, or anything that breaks a platform\'s rules.',
        },
        {
          t: 'p',
          c: 'We do not check posts before they go out, and you are fully responsible for what you publish. That includes content that is hateful, racist, sexually explicit, defamatory, misleading or illegal, political content and misinformation. If a post gets you into legal trouble, that is on you, not on Sosial. We can remove content or close accounts that break these terms or the law.',
        },
      ],
    },
    {
      title: '5. Messages and comments',
      blocks: [
        {
          t: 'p',
          c: 'On some channels you can read and answer direct messages and comments inside Sosial. Today that means direct messages on Facebook Pages, Instagram, X, Mastodon and Bluesky, and comments on Facebook, Instagram, Threads, X, Mastodon, Bluesky and YouTube. Your replies go out from your own account, the same as if you typed them on the platform.',
        },
        {
          t: 'p',
          c: 'Those messages are written by other people. You are responsible for what you send back, and for following each platform\'s rules and any anti-spam or consent laws that apply to you. Do not use the inbox to spam, harass or mislead anyone.',
        },
        {
          t: 'p',
          c: 'Nothing is sent unless you write it and press send. Disconnecting a channel stops new messages from loading. Deleting your workspace deletes the messages and comments we saved.',
        },
      ],
    },
    {
      title: '6. Imports, automations and AI',
      blocks: [
        {
          t: 'p',
          c: 'You can bring content in from Dropbox, Canva, Unsplash and OneDrive. We only download the file you pick, and we never change, move or delete anything in those accounts. Notion and Google Sheets imports only go one way, into your drafts. Zapier and AI agents (through MCP) can create posts using an API key you make and can delete whenever you like. Google Drive and Google Photos are marked "Soon" until Google finishes reviewing our access.',
        },
        {
          t: 'p',
          c: 'Our AI features (the writer, channel-by-channel captions, and blog and studio drafts) send your brief and the material you choose to OpenAI, and the result comes back to your workspace. We do not use what you send to train AI. If you turn on web research, the writer searches the web and shows you the sources it used. AI can get things wrong, so read the result before you post it. You are still responsible for what goes out.',
        },
      ],
    },
    {
      title: '7. Team workspaces',
      blocks: [
        {
          t: 'p',
          c: 'Every workspace has one owner and can have admins and members. The owner decides who joins and what role they get, pays for the workspace, and is responsible for what it publishes. A workspace can require members to send posts for approval, and an owner or admin then has to approve them before they publish. Whoever approves a post shares responsibility for it with the person who wrote it.',
        },
      ],
    },
    {
      title: '8. Uptime and changes',
      blocks: [
        {
          t: 'p',
          c: 'We work hard to keep Sosial running, but we cannot promise it will never go down or that every post will go out on time. The service is provided "as is", without warranties. We may change, pause or remove features. If a change makes a real difference for paying customers, we will tell you in advance.',
        },
      ],
    },
    {
      title: '9. Our liability',
      blocks: [
        {
          t: 'p',
          c: 'As far as the law allows, we are not liable for indirect losses, such as lost reach, lost sales or a post that failed to publish. If we are found liable for something, the most we will pay is what you paid us in the 12 months before the claim.',
        },
      ],
    },
    {
      title: '10. Emails we send',
      blocks: [
        {
          t: 'p',
          c: 'We only send product news and tips if you tick the box at signup or turn it on in your settings. It is optional and changes nothing about how Sosial works for you. Every one of those emails has an unsubscribe link that works right away. Account emails, like security alerts, receipts and publishing notices, are not marketing, so they keep coming either way.',
        },
      ],
    },
    {
      title: '11. Inactive accounts',
      blocks: [
        {
          t: 'p',
          c: 'If nobody signs in or uses an account for six months in a row, we may delete it along with its posts, media, templates, connected channels and workspace. We email you a month before that happens, and signing in during that month stops it. A shared workspace stays as long as any one member is still active. Accounts with an active paid plan are never deleted for inactivity. We do this so we are not holding on to people\'s data after they have moved on.',
        },
      ],
    },
    {
      title: '12. Deleting your data',
      blocks: [
        {
          t: 'p',
          c: 'You can delete your workspace whenever you want. That removes your content, connected accounts and personal details. A few records can stay in backups for a short time, or longer if the law says we must keep them. Deleting your data does not cancel billing, so cancel any paid plan first.',
        },
      ],
    },
    {
      title: '13. Contact',
      blocks: [
        {
          t: 'p',
          c: 'Questions about these terms? Email support@sosial.app and a person on our team will reply. Sosial is run by EGATE WORLDWIDE.',
        },
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  updated: '2026-10-27',
  summary:
    'What we collect, why, who else sees it, how we keep it safe and how to delete it. In plain words.',
  sections: [
    {
      title: 'What we collect',
      blocks: [
        {
          t: 'ul',
          c: [
            'Your account: your email address and a password (stored encrypted), or the account you signed in with, such as Google.',
            'Your workspace: posts, captions, schedules, media, templates, who approved what, and the roles of the people on your team.',
            'Connected channels: each account\'s name and handle, plus the key that lets us publish for you. Depending on the platform that is a login token, a bot or API key, or your Bluesky app password. All of these are encrypted before we save them.',
            'Inbox: the messages and comments we load for the channels where you use the inbox (more on this below).',
            'Notifications: a push token for each device where you turned notifications on.',
            'Imports and automations: the Notion page or Google Sheet you import from and the content you bring in, and any API keys you create for Zapier or AI agents.',
            'Billing: Stripe handles payments on the web, and the app store handles them on mobile. We only keep a customer and subscription reference. We never see your card number.',
          ],
        },
      ],
    },
    {
      title: 'Your connected social accounts',
      blocks: [
        {
          t: 'p',
          c: 'When you connect a channel, the platform gives us a key so we can publish your scheduled posts. For most platforms that is a login token. For WordPress, Telegram, Discord and Ghost it is an app password, bot token or API key. For Bluesky it is your handle and an app password, which we keep encrypted and only use to start short publishing sessions. We never see or store the password you use to log in to a social network.',
        },
        {
          t: 'p',
          c: 'Here is what we do with each one:',
        },
        {
          t: 'ul',
          c: [
            'X: read your profile, post and upload media for your scheduled posts, and read and answer direct messages. X needs a paid Sosial plan because X charges for its API.',
            'Instagram: read your Business or Creator profile, publish your photos, videos and reels, and read comments and direct messages so you can answer them. We do not ask for access to your Instagram insights.',
            'TikTok: read your basic profile and video stats, publish your videos and photos, and check your posted videos to confirm they went out.',
            'Facebook: list the Pages you manage, publish to them, and read their posts, comments and Messenger conversations so you can reply. We never touch your personal profile.',
            'Threads: read your profile, publish your posts, read and answer replies, and read stats for posts made through Sosial.',
            'Bluesky: publish your posts with their images and video, and read and answer direct messages and comments.',
            'Mastodon: on the server you choose, publish your posts and media, and read and answer direct messages and comments. We save your server address so posts reach the right place.',
            'LinkedIn: once LinkedIn approves us, confirm who you are, publish as you or as a Company Page you run, and read those posts and their stats.',
            'YouTube: upload videos, check your channel and video list to confirm uploads, and manage comments on videos you posted through Sosial.',
            'Pinterest: read your account and boards, and publish your scheduled Pins to the boards you pick.',
            'WordPress, Dev.to, Hashnode and Ghost: publish your scheduled articles (and their cover images, where the platform supports it) to the site or publication you connect.',
            'Telegram and Discord: send your scheduled posts to a channel, group or server through a bot you add.',
            'VK: publish your scheduled posts to your VK profile or community.',
            'Google Business Profile: once Google approves us, publish posts to a business location you manage.',
          ],
        },
        {
          t: 'p',
          c: 'LinkedIn and Google Business Profile are marked "Soon". You can see them in the app, but they cannot be connected yet, and we collect nothing for them until they can.',
        },
        {
          t: 'p',
          c: 'You can disconnect a channel at any time on the Channels screen. That deletes its key and stops publishing. If you also want everything we saved for that channel gone, use Delete data, which removes its posts, stats, comments and messages. You can also remove Sosial\'s access from the platform\'s own settings, which stops publishing straight away.',
        },
      ],
    },
    {
      title: 'Media and import sources',
      blocks: [
        {
          t: 'p',
          c: 'When you add a photo or video from one of these sources, we show you your files so you can pick one, then download only that file. We never change, move, share or delete anything in your storage or design library. Unsplash photos automatically get the photographer\'s name and link in your caption, because Unsplash\'s license asks for it.',
        },
        {
          t: 'ul',
          c: [
            'Dropbox and OneDrive: browse your folders and download the file you pick.',
            'Canva: browse your designs and download the one you pick.',
            'Unsplash: search for photos and add the one you pick, with its credit.',
            'Notion: turn pages you have shared with Sosial into drafts. Nothing is written back to Notion.',
            'Google Sheets: turn rows from a sheet you share into scheduled posts. Nothing is written back to the sheet.',
            'Zapier and MCP: let your own automations and AI agents create posts, using an API key you make and can delete at any time.',
          ],
        },
        {
          t: 'p',
          c: 'Google Drive and Google Photos are marked "Soon" while Google reviews our access. We do not touch any Drive or Photos data until then.',
        },
        {
          t: 'p',
          c: 'Login tokens for Dropbox, OneDrive and Canva stay on your device (in your phone\'s secure storage, or your browser on the web). They never reach our servers, and disconnecting a source deletes them from your device right away.',
        },
      ],
    },
    {
      title: 'How we use your data',
      blocks: [
        {
          t: 'ul',
          c: [
            'To publish your posts at the times you set.',
            'To show your calendar, queue, inbox, comments and results.',
            'To run approvals and let the right teammates know when something needs a look.',
            'To send the notifications you turned on, and account emails like sign-in links, invites and notices.',
            'To handle your subscription and answer your support requests.',
          ],
        },
        {
          t: 'p',
          c: 'We do not sell your data. We do not use your content to train AI. We do not use Google user data for ads. Our use of data we get from Google APIs follows the Google API Services User Data Policy, including its Limited Use rules.',
        },
      ],
    },
    {
      title: 'AI features',
      blocks: [
        {
          t: 'p',
          c: 'When you use the writer, channel captions, or blog and studio drafts, we send your brief and the material you chose to OpenAI, and the result comes back to your workspace. We do not train AI on it, and OpenAI does not train on data sent through its API. If you turn on web research, the writer searches the web and shows you the sources it used. AI can make mistakes, so check the result before you publish.',
        },
      ],
    },
    {
      title: 'Messages and comments',
      blocks: [
        {
          t: 'p',
          c: 'If you use the inbox, we load the direct messages and comments that arrive on your connected channels so you can see and answer them in one place. That covers direct messages on Facebook Pages, Instagram, X, Mastodon and Bluesky, and comments on Facebook, Instagram, Threads, X, Mastodon, Bluesky and YouTube. The other channels do not give us messages or comments.',
        },
        {
          t: 'ul',
          c: [
            'For messages we save: the other person\'s name and profile picture, what each of you wrote, attachments, the time, and whether it was sent or received.',
            'For comments we save: the author\'s name and profile picture, the comment, which post it is on, the time, and whether you replied.',
          ],
        },
        {
          t: 'p',
          c: 'We check each platform for new messages on a schedule and when the platform tells us something new arrived, and we save them so your inbox loads quickly. Anyone in your workspace who can see a channel can read its inbox. Messages stay until you use Delete data for that channel or delete your workspace. Deleting a message on the platform does not remove it from Sosial, so you do not lose the thread you were working on. We never sell this data, use it for ads, or train AI on it.',
        },
      ],
    },
    {
      title: 'Notifications',
      blocks: [
        {
          t: 'p',
          c: 'If you turn on push notifications, your device gets a push token from Expo, which delivers them for us. We save it with your account and device type so we can tell you when a post goes out, fails or needs approval, or when your team changes. A notification can show a post title or a teammate\'s name, so that much may appear on your lock screen. You can turn notifications off in the app or in your phone\'s settings, and we delete the token when you delete your account.',
        },
      ],
    },
    {
      title: 'Who else sees your data',
      blocks: [
        {
          t: 'p',
          c: 'Only the companies we need to run Sosial, and only for that:',
        },
        {
          t: 'ul',
          c: [
            'The social platforms you connect, to publish your posts and load your inbox.',
            'Supabase, which runs our database, sign-in and part of our file storage.',
            'Cloudflare, which stores your uploaded media (R2) and protects our domains.',
            'Vercel, which hosts the Sosial website and web app.',
            'The hosting providers that run our background worker, which publishes your scheduled posts and syncs your inbox.',
            'Expo, which delivers push notifications to your phone.',
            'Resend, which sends our emails.',
            'OpenAI, for the AI features you choose to use.',
            'Stripe and the app stores, for payments.',
            'The import sources you connect (Dropbox, Canva, Unsplash, OneDrive, Notion, Google Sheets), only to fetch what you pick, and Zapier or an AI agent, only through an API key you created.',
          ],
        },
        {
          t: 'p',
          c: 'These companies can only use your data to provide their service to us, and they are bound by contract to protect it. We may also share data if the law requires it or to protect people\'s safety, and where we are allowed to, we will tell you first.',
        },
        {
          t: 'p',
          c: 'We do not sell Google user data, use it for ads, or use it to train general AI models. No one on our team reads your Google data unless you ask us to for support, it is needed for security or the law, or it has been made anonymous.',
        },
      ],
    },
    {
      title: 'How we keep it safe',
      blocks: [
        {
          t: 'ul',
          c: [
            'Everything travels over HTTPS (TLS 1.2 or newer).',
            'Our database, file storage and backups are encrypted.',
            'Channel keys, app passwords and API keys are encrypted with AES-256-GCM before they are saved. They are only unlocked when we need to publish or load your inbox, and never shown in the app or written to logs.',
            'We ask platforms for the smallest set of permissions each feature needs.',
            'Only the people who run Sosial can reach our production systems, they need two-factor sign-in to do it, and that access is logged.',
            'Encryption keys live in a secrets manager, not in our code, and we change them regularly.',
            'If there is ever a breach that affects your data, we will tell you, and Google where it involves Google data, as soon as we can.',
          ],
        },
      ],
    },
    {
      title: 'How long we keep it',
      blocks: [
        {
          t: 'p',
          c: 'We keep your data while your account is active. When you delete your workspace, we delete your content, connected accounts and personal details. A few records may stay a little longer for legal, tax or security reasons, and old copies in backups expire on their own.',
        },
        {
          t: 'p',
          c: 'Accounts with no sign-ins or activity for six months are deleted with all their data. We email you a month before, and signing in stops it. Accounts on an active paid plan are never deleted for inactivity, and a shared workspace stays as long as one member is active. Support tickets and their screenshots are deleted 30 days after the ticket is closed. You can also delete everything yourself at any time from your profile or on the [deletion page](/delete-data).',
        },
      ],
    },
    {
      title: 'Marketing emails',
      blocks: [
        {
          t: 'p',
          c: 'We only send product news and tips if you ask for them, at signup or in your settings. Every email has an unsubscribe link that works right away. We never give your email address to advertisers, and unsubscribing does not stop account emails like security alerts, receipts or publishing notices.',
        },
      ],
    },
    {
      title: 'Your choices',
      blocks: [
        {
          t: 'ul',
          c: [
            'See and export: everything in your workspace is visible to you, and you can export your content at any time.',
            'Fix: you can edit or delete any post, draft or connected channel.',
            'Delete: you can delete your workspace and everything in it. [Request deletion](/delete-data).',
          ],
        },
      ],
    },
    {
      title: 'Cookies',
      blocks: [
        {
          t: 'p',
          c: 'We use one cookie, to keep you signed in. There are no ad trackers and no third-party analytics following you around the web.',
        },
      ],
    },
    {
      title: 'Children',
      blocks: [
        {
          t: 'p',
          c: 'Sosial is a work tool and is not meant for children. We do not knowingly collect data from anyone too young to have a social media account where they live.',
        },
      ],
    },
    {
      title: 'Changes and contact',
      blocks: [
        {
          t: 'p',
          c: 'If we make an important change to this policy, we will tell you in the app first. Questions about your data? Email support@sosial.app. EGATE WORLDWIDE is responsible for your data under this policy.',
        },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<'terms' | 'privacy', LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
};
