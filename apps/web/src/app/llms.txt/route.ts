import { PLANS, PLAN_ORDER } from '@/lib/billing/plans';
import { allArticles } from '@/lib/blog';
import { docsUrl } from '@/lib/site';
import { SITE_URL } from '@/lib/seo';
import { CHANNEL_GUIDES } from '@/content/channels';
import { COMPETITORS, competitorHref } from '@/content/competitors';
import { allResources } from '@/content/resources';
import { blogHref, channelHref, resourceHref } from '@/content/types';

/**
 * sosial.app/llms.txt (llmstxt.org): a plain markdown map of the site for AI
 * answer engines. Plans and channels come from the same sources as the
 * pricing and integration pages, so this never drifts from them. The docs
 * host serves its own (app/docs/llms.txt).
 */
export const revalidate = 3600;

const link = (title: string, path: string, note?: string) =>
  `- [${title}](${path.startsWith('http') ? path : `${SITE_URL}${path}`})${note ? `: ${note}` : ''}`;

function plans(): string {
  return PLAN_ORDER.map((k) => {
    const p = PLANS[k];
    const price = p.monthly.price === 0 ? 'free' : `$${p.monthly.price}/month or $${p.annual.price}/year`;
    return `- **${p.label}** (${price}): ${p.points.join('; ')}`;
  }).join('\n');
}

export async function GET() {
  let posts: { slug: string; title: string; description: string }[] = [];
  try {
    posts = await allArticles();
  } catch {
    /* the rest of the map still serves */
  }

  const body = `# Sosial

> Sosial is a social media scheduler: write a post once, check it against each network's real limits, and schedule or publish it to ${CHANNEL_GUIDES.length} channels from one composer, calendar and cloud queue. It includes team approvals, analytics, a comments and messages inbox, an AI writer, a REST API and an MCP server. It runs on the web, iOS and Android.

Key facts:
- Channels: ${CHANNEL_GUIDES.map((c) => c.name).join(', ')}.
- Posts publish from the cloud at their scheduled time, with the app closed.
- Sosial does not do social listening or ad buying.
- Made by EGATE WORLDWIDE. Support: support@sosial.app.

## Pricing

${plans()}

Annual billing is 10 months' price for 12. Full details: ${SITE_URL}/pricing

## Product

${link('Features', '/features', 'everything Sosial does')}
${link('Publishing', '/publish', 'calendar, queue and per-channel limits')}
${link('Create', '/features/create', 'the composer and design studio')}
${link('AI assistant', '/ai-assistant', 'the AI writer, research and sources')}
${link('Pricing', '/pricing')}
${link('Integrations', '/integrations', 'every supported channel')}
${link('Transparency', '/transparency')}

## Comparisons

${link('Compare approaches', '/compare', 'Sosial vs suites, single-network apps and posting by hand')}
${COMPETITORS.map((c) => link(`Sosial vs ${c.name}`, competitorHref(c.slug), c.verdict)).join('\n')}

## Integrations

${CHANNEL_GUIDES.map((c) => link(`${c.name} scheduler`, channelHref(c.key), c.tagline)).join('\n')}

## Docs

${link('Documentation', docsUrl(), 'setup for every channel, API and MCP reference')}
${link('Docs for LLMs', `${docsUrl()}/llms.txt`, 'docs index; full text at /llms-full.txt')}
${link('REST API', `${docsUrl()}/api`)}

## Resources

${allResources().map((r) => link(r.title, resourceHref(r.slug), r.description)).join('\n')}

## Blog

${posts.map((p) => link(p.title, blogHref(p.slug), p.description)).join('\n')}

## Optional

${link('About', '/about')}
${link('Made for everyone', '/made-for-everyone')}
${link('Terms', `${docsUrl()}/terms`)}
${link('Privacy', `${docsUrl()}/privacy`)}
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
