import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developers — Sosial API',
  description:
    'One API key connects Zapier, Make or your own code to Sosial: schedule posts to every channel with a single POST.',
  alternates: { canonical: '/developers' },
};

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-line bg-ink p-4 font-mono text-[13px] leading-relaxed text-paper">
      {children}
    </pre>
  );
}

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'One key, every automation',
    body: [
      'The Sosial API is a small REST surface authenticated with a workspace API key. Anything that can send an HTTPS request — Zapier, Make, n8n, a cron job, your own backend — can draft, schedule and publish posts through the same queue the app uses, with the same limits and the same plan quotas.',
      'Keys post with owner permissions and are scoped to one workspace. Create one per integration so a leak only ever costs you one key: revoke it and that automation goes quiet while everything else keeps running.',
    ],
  },
  {
    title: 'Get a key',
    body: [
      'Open Team in your workspace (owners and admins only), scroll to API keys, name the key — e.g. “Zapier” — and press Create key. The plaintext is shown once: copy it into your automation now, because it is never displayed again. Only its prefix is listed afterwards so you can tell keys apart.',
    ],
  },
  {
    title: 'Endpoints',
    body: [
      'Base URL is https://sosial.app. Every request carries the key as `Authorization: Bearer <key>`.',
      'GET /api/v1/me — auth probe. Returns your workspace id, name and plan. Zapier uses this as its “test authentication” call.',
      'GET /api/v1/posts?status=sent&limit=20 — newest posts first. Poll it (optionally filtered by status) to trigger Zaps when posts go out.',
      'POST /api/v1/posts — create a post. `text` and `channels` are required; one call targets every connected account of each listed provider. Omit `scheduled_at` for a draft, pass mode "now" to queue immediately, or pass an ISO `scheduled_at` (at least 5 minutes out) to schedule.',
    ],
  },
];

/** Keep in sync with POST /api/v1/posts. */
const CREATE_CURL = `curl -X POST https://sosial.app/api/v1/posts \\
  -H "Authorization: Bearer sos_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Morning Brew #42 is live — link in bio.",
    "channels": ["instagram", "tiktok", "x"],
    "scheduled_at": "2026-10-05T09:00:00Z",
    "timezone": "Asia/Kuala_Lumpur",
    "media_urls": ["https://example.com/cover.jpg"],
    "idempotency_key": "brew-42"
  }'`;

const LIST_CURL = `curl "https://sosial.app/api/v1/posts?status=sent&limit=10" \\
  -H "Authorization: Bearer sos_live_..."`;

export default function DevelopersPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <p className="eyebrow">Developers</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">
        Put Sosial inside any workflow.
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">
        One API key connects Zapier, Make or your own code to your workspace. Schedule posts
        to every channel with a single POST — no OAuth dance, no SDK.
      </p>

      <hr className="my-10 border-line" />

      <div className="space-y-10">
        {SECTIONS.slice(0, 2).map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-xl font-extrabold tracking-tight">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="prose-sosial mt-3">
                {p}
              </p>
            ))}
          </section>
        ))}

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Endpoints</h2>
          <p className="prose-sosial mt-3">{SECTIONS[2].body[0]}</p>
          <div className="prose-sosial mt-3 space-y-3">
            <p>{SECTIONS[2].body[1]}</p>
            <p>{SECTIONS[2].body[2]}</p>
            <p>{SECTIONS[2].body[3]}</p>
          </div>
          <h3 className="mt-6 font-display text-base font-extrabold">Schedule a post</h3>
          <div className="mt-3">
            <Code>{CREATE_CURL}</Code>
          </div>
          <h3 className="mt-6 font-display text-base font-extrabold">List recent posts</h3>
          <div className="mt-3">
            <Code>{LIST_CURL}</Code>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Zapier in 5 minutes</h2>
          <div className="prose-sosial mt-3 space-y-3">
            <p>
              1. In your workspace open Team, create an API key named “Zapier”, and copy it.
            </p>
            <p>
              2. In Zapier add a “Webhooks by Zapier” step: POST to
              https://sosial.app/api/v1/posts with a header
              `Authorization: Bearer &lt;key&gt;` and your JSON body. Map the trigger&apos;s
              text, image URL and publish time into `text`, `media_urls` and `scheduled_at`.
            </p>
            <p>
              3. For triggers in the other direction (“when Sosial publishes…”), use a
              “Schedule” + “Webhooks GET” pair polling
              `/api/v1/posts?status=sent`, or a “Catch Hook” if you front it with your own
              poller. Retries are safe: send the same `idempotency_key` and the duplicate
              returns the original post instead of posting twice.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Make (Integromat)</h2>
          <div className="prose-sosial mt-3 space-y-3">
            <p>
              Drop in an HTTP “Make a request” module: POST, same URL and Bearer header as
              above. To watch for published posts, schedule a scenario that GETs
              `/api/v1/posts?status=sent` and filters on `created_at` newer than the last
              run.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Limits, honestly</h2>
          <div className="prose-sosial mt-3 space-y-3">
            <p>
              API posts count against the same plan quotas as the app — a full workspace
              answers 402, never a silent drop. Media is capped at 5 files of 25&nbsp;MB
              each, fetched server-side from https URLs. Schedules need the same 5-minute
              lead the composer enforces. Channels must already be connected in Sosial;
              unknown or disconnected providers come back 400 naming exactly which one.
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}
