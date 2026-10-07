import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reddit integration — Sosial',
  description:
    'How Sosial integrates with Reddit: OAuth scopes, endpoints used, user-initiated publishing, rate-limit handling, and data storage. Written for the Reddit Data API review team.',
  alternates: { canonical: '/developers/reddit' },
};

const SCOPES: { scope: string; why: string }[] = [
  { scope: 'identity', why: 'Read the connecting user’s username and avatar once, at connect time, to label the channel in the app.' },
  { scope: 'mysubreddits', why: 'List the subreddits the user personally subscribes to, to power a picker. The user can only ever target communities they are a member of.' },
  { scope: 'submit', why: 'Submit the user’s own text post to the subreddit they picked, at the time they scheduled.' },
  { scope: 'read', why: 'Read the submitted post’s permalink and score after publishing, so the app can link back to the live thread and show basic stats.' },
];

const ENDPOINTS: { call: string; why: string }[] = [
  { call: 'POST /api/v1/access_token', why: 'Refresh the hourly access token from the permanent refresh token (duration=permanent) before each publish.' },
  { call: 'GET /api/v1/me', why: 'One identity read at connect time.' },
  { call: 'GET /subreddits/mine/subscriber', why: 'Populate the subreddit picker at connect time. Paginated; nothing is bulk-read afterwards.' },
  { call: 'POST /api/submit', why: 'One call per publish: api_type=json, kind=self, the picked subreddit, title (≤300 chars) and text (≤40,000 chars).' },
];

const GUARANTEES: { title: string; body: string }[] = [
  {
    title: 'Publishing is always user-initiated',
    body: 'Every post requires a human action in Sosial — compose, review, and confirm. There is no auto-commenting, auto-voting, cross-posting, DMing, following, scraping, or bulk reading anywhere in the integration. One scheduled post per user action; typical volume is a handful of posts per account per day.',
  },
  {
    title: 'Community rules are respected, not worked around',
    body: 'Sosial targets only subreddits the connected account is subscribed to (enforced by the picker). Reddit’s own moderation errors are surfaced to the user verbatim and translated into plain guidance — rate limits (“wait ~10 minutes”), restricted communities (“check its rules, karma minimums, or mod approval”), duplicates (ALREADY_SUB) — and the app never auto-retries against a community that rejected a post.',
  },
  {
    title: 'Text (self) posts only',
    body: 'The v1 integration submits kind=self posts exclusively: no link posts, no hosted media uploads, no flair manipulation, no mod actions. The composer enforces Reddit’s limits (title ≤300 chars, body ≤40,000 chars) before submission.',
  },
  {
    title: 'Rate limits and identification',
    body: 'Every API request carries the descriptive User-Agent “web:Sosial:v1.0 (by /u/sosialapp)”. The publisher honors 429 responses with the queue’s exponential backoff (2^attempts, capped), and honors Retry-After when present. Nothing circumvents or retries around rate limits.',
  },
  {
    title: 'Token storage and revocation',
    body: 'OAuth tokens are encrypted at rest in the workspace’s dedicated secret vault (Supabase Vault); plaintext never reaches application logs or the browser. Disconnecting the channel in Sosial deletes the stored tokens immediately, and users can revoke Sosial from reddit.com/app (authorized apps) at any time, which immediately stops all access.',
  },
  {
    title: 'What Sosial never does',
    body: 'No data is sold, shared, or used for advertising or AI/ML training. No third party receives Reddit data. Access is limited to the connected user’s own identity, their own subscriptions, and posts they author through the app.',
  },
];

export default function RedditIntegrationPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <p className="eyebrow">Developers · Reddit</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">
        Sosial&apos;s Reddit integration.
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">
        Sosial is a social media scheduling studio: write once, publish to 19 networks on
        schedule. This page documents exactly how the Reddit integration works — written for
        the Reddit Data API review team, and for any user who wants to know what Sosial does
        with their Reddit account.
      </p>

      <hr className="my-10 border-line" />

      <div className="space-y-10">
        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">What it does</h2>
          <p className="prose-sosial mt-3">
            A Reddit user connects their own account inside Sosial via standard OAuth
            (confidential web-app client, duration=permanent). They pick one of their own
            subscribed subreddits from a picker, compose a title and body, review it, and
            choose Post now or a scheduled time. At publish time Sosial submits that single
            text post to that single subreddit under the user&apos;s own account, then links
            the live thread back in the app.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Scopes requested</h2>
          <p className="prose-sosial mt-3">
            Four scopes, each tied to one visible feature. Nothing broader is requested.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Scope</th>
                  <th className="px-4 py-2.5 font-bold">Why it is needed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {SCOPES.map((s) => (
                  <tr key={s.scope}>
                    <td className="px-4 py-3 align-top font-mono text-[13px] font-bold">{s.scope}</td>
                    <td className="px-4 py-3 align-top text-muted">{s.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">API calls used</h2>
          <p className="prose-sosial mt-3">
            The complete list. No other endpoints are called.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Call</th>
                  <th className="px-4 py-2.5 font-bold">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {ENDPOINTS.map((e) => (
                  <tr key={e.call}>
                    <td className="px-4 py-3 align-top font-mono text-[13px] font-bold">{e.call}</td>
                    <td className="px-4 py-3 align-top text-muted">{e.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">
            Conduct guarantees
          </h2>
          <div className="mt-4 space-y-3">
            {GUARANTEES.map((g) => (
              <div key={g.title} className="rounded-2xl border border-line bg-card p-4">
                <h3 className="font-display text-base font-extrabold">{g.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{g.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Contact</h2>
          <p className="prose-sosial mt-3">
            Questions about this integration, security reports, or data-deletion requests:{' '}
            <a
              href="mailto:support@sosial.app"
              className="font-bold text-accent-ink underline underline-offset-2"
            >
              support@sosial.app
            </a>
            . Privacy policy:{' '}
            <a href="/privacy" className="font-bold text-accent-ink underline underline-offset-2">
              sosial.app/privacy
            </a>
            . Data-deletion:{' '}
            <a href="/delete-data" className="font-bold text-accent-ink underline underline-offset-2">
              sosial.app/delete-data
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
