/**
 * Single home for the app's legal copy — the pre-login consent sheet, the
 * Account → Terms view and the Privacy Policy screen all render from here
 * so the words can never drift apart.
 */

export const TERMS_TEXT =
  'Sosial is a personal content studio. Your designs, ideas and posts are stored on your own device; social tokens are kept in the device keychain and used only to publish where you ask us to.\n\n' +
  'Don’t publish content you don’t own or have rights to. Publishing to Facebook, Instagram and Threads is also governed by Meta’s terms.\n\n' +
  'Sosial is provided as-is, without warranties.';

export interface LegalSection {
  title: string;
  body: string;
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'Local-first, no accounts',
    body: 'Sosial works entirely on your device. There are no accounts, no sign-ups, and no servers receiving your content. Your designs, posts, templates and schedules are stored only in your phone’s local storage.',
  },
  {
    title: 'Your photos stay yours',
    body: 'When you pick a profile picture, background, content image or video, the file stays on your device and is used only inside your designs. Exported images save straight to your photo library. Nothing is uploaded anywhere by Sosial itself.',
  },
  {
    title: 'Reminders live on your phone',
    body: 'Scheduled post alerts are local notifications created and fired by your own device. No reminder data leaves your phone.',
  },
  {
    title: 'Sharing is manual',
    body: 'Posting to social apps happens through your phone’s share sheet and official apps. Sosial copies your caption to the clipboard and opens the app you choose — it never posts, reads, or accesses your social accounts on its own.',
  },
  {
    title: 'Social connections (optional)',
    body: 'If you connect a Facebook, Instagram or Threads account in the future, login tokens are kept in your device’s secure storage and used only to publish posts you explicitly approve. You can disconnect at any time from the connected app’s settings, which revokes access immediately.',
  },
  {
    title: 'Analytics & tracking',
    body: 'Sosial collects no analytics, shows no ads, and embeds no third-party trackers.',
  },
  {
    title: 'Children',
    body: 'Sosial is a general productivity tool with no age-gated content, and collects no personal data from anyone.',
  },
  {
    title: 'Changes',
    body: 'If this policy changes, the updated version ships inside the app. Continued use after an update means you accept the current policy.',
  },
  {
    title: 'Contact',
    body: 'Questions about privacy? Reach us at egateworldwide on GitHub and we’ll answer.',
  },
];
