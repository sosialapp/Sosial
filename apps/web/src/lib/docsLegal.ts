import { LEGAL_DOCS, type LegalDoc } from '@/content/legal';
import type { Block } from '@/content/types';
import type { DocsPage, DocsSection } from './docs';

/**
 * Terms of Use and Privacy Policy as docs pages (docs.sosial.app/terms,
 * /privacy), built from the same content/legal.ts as sosial.app/terms and
 * /privacy, so the two can never disagree. They aren't rows in docs_pages:
 * legal text is changed in code (or the CMS Pages editor), not the docs
 * admin. Each ends with a changelog, newest first.
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sosial.app').replace(/\/+$/, '');

export const LEGAL_SECTION: DocsSection = { id: 'legal', slug: 'legal', title: 'Legal', position: 10_000 };

/** What changed, per document. Add an entry whenever content/legal.ts changes. */
export const LEGAL_CHANGELOG: Record<LegalDoc['slug'], { date: string; changes: string[] }[]> = {
  terms: [
    {
      date: '2026-10-27',
      changes: [
        'Rewritten in plain language.',
        'Now covers every channel, the inbox, approvals, notifications and the AI writer.',
        'Removed mentions of comment moderation features that are not available yet.',
      ],
    },
    { date: '2026-10-24', changes: ['Added sections on messages and comments.', 'Effective date set to 24 October 2026.'] },
    {
      date: '2026-10-13',
      changes: [
        'Covers AI, integrations, the MCP server and account deletion.',
        'Added that you are responsible for the content you publish.',
        'Clearer wording on team safety and a simpler contact section.',
      ],
    },
    { date: '2026-10-12', changes: ['Sign-up consent and the marketing email opt-in.'] },
    { date: '2026-10-08', changes: ['Updated for 18 channels and the live integrations.'] },
    { date: '2026-09-26', changes: ['Names EGATE WORLDWIDE as the operator, with support@sosial.app as the contact.'] },
    { date: '2026-09-21', changes: ['Explains how Sosial uses each platform’s API.'] },
  ],
  privacy: [
    {
      date: '2026-10-27',
      changes: [
        'Rewritten in plain language, with the current list of service providers.',
        'Now covers every channel, the inbox, approvals, notifications and the AI writer.',
        'Removed mentions of comment moderation features that are not available yet.',
      ],
    },
    {
      date: '2026-10-24',
      changes: [
        'Added sections on messages and comments.',
        'Disconnecting a channel keeps its post history; Delete data erases it.',
        'Effective date set to 24 October 2026.',
      ],
    },
    { date: '2026-10-17', changes: ['Added OneDrive and Pinterest.'] },
    { date: '2026-10-13', changes: ['Covers AI, integrations, the MCP server, deletion, and how long support tickets are kept.'] },
    { date: '2026-10-12', changes: ['Sign-up consents and the marketing email opt-in.'] },
    {
      date: '2026-10-08',
      changes: ['Updated for 18 channels and the live integrations.', 'Added how Google user data is shared and protected.'],
    },
    { date: '2026-10-05', changes: ['Lists which media sources Sosial can access, and why.'] },
    { date: '2026-09-29', changes: ['Links the dedicated data deletion page.'] },
    { date: '2026-09-26', changes: ['Names EGATE WORLDWIDE as the operator, with support@sosial.app as the contact.'] },
    { date: '2026-09-21', changes: ['Explains how Sosial uses each platform’s API.'] },
  ],
};

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Site-relative links in the legal copy point at sosial.app from the docs. */
function absolutize(s: string): string {
  return s.replace(/\]\((\/[^)]*)\)/g, `](${SITE}$1)`);
}

function blocksToMd(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case 'p':
          return absolutize(b.c);
        case 'h':
          return `### ${b.c}`;
        case 'ul':
          return b.c.map((x) => `- ${absolutize(x)}`).join('\n');
        case 'quote':
          return `> ${absolutize(b.c)}`;
        case 'img':
          return `![${b.alt ?? ''}](${b.c})`;
        case 'table': {
          const [head, ...rows] = b.head === false ? [b.c[0].map(() => ''), ...b.c] : b.c;
          const line = (r: string[]) => `| ${r.map((c) => absolutize(c).replace(/\|/g, '\\|')).join(' | ')} |`;
          return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(line)].join('\n');
        }
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

/** The "## Changelog" section that closes each legal page. */
export function legalChangelogMarkdown(slug: LegalDoc['slug']): string {
  const log = LEGAL_CHANGELOG[slug]
    .map((e) => `### ${longDate(e.date)}\n\n${e.changes.map((c) => `- ${c}`).join('\n')}`)
    .join('\n\n');
  return `## Changelog\n\nWhat changed in this document, newest first.\n\n${log}\n`;
}

export function legalMarkdown(doc: LegalDoc): string {
  const body = doc.sections.map((s) => `## ${s.title}\n\n${blocksToMd(s.blocks)}`).join('\n\n');
  return `${body}\n\n${legalChangelogMarkdown(doc.slug)}`;
}

/** Terms and Privacy as docs pages, in the Legal section. */
export function legalDocsPages(): DocsPage[] {
  return (['terms', 'privacy'] as const).map((slug, i) => {
    const doc = LEGAL_DOCS[slug];
    return {
      id: `legal-${slug}`,
      sectionId: LEGAL_SECTION.id,
      parentId: null,
      slug,
      title: doc.title,
      description: doc.summary,
      bodyMd: legalMarkdown(doc),
      position: i,
      published: true,
      icon: slug === 'privacy' ? 'shield' : 'file',
      updatedAt: `${doc.updated}T00:00:00Z`,
    };
  });
}
