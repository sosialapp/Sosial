# Sosial Web

The web dashboard for Sosial: a composer + content calendar that reads and
writes the **same Supabase backend** as the mobile app. A post scheduled here
is a `posts` row with `post_targets` — the Railway worker picks it up from
`job_queue` and publishes it exactly like a mobile-scheduled post. Nothing is
duplicated and nothing is siloed.

## Why this shape

The P1–P8 schema is already a server-side model of the product (`posts`,
`post_targets`, `post_media`, `media_assets`, `approvals`), and its RLS is
scoped to `is_workspace_member()` — i.e. any authenticated client, not just the
worker. So the web app is a second client of the same backend, not a second
backend. The `post-media` bucket is shared too.

## Run it

```bash
cp .env.example .env.local     # fill in the SAME Supabase URL + anon key
npm install
npm run dev                    # http://localhost:3000
```

`NEXT_PUBLIC_SITE_URL` must match where the app runs so the Google OAuth
redirect (`/auth/callback`) comes back correctly. In Supabase →
Auth → URL Configuration, add:

- `http://localhost:3000/auth/callback`
- `https://sosial.app/auth/callback` (production)

Google button also needs the provider enabled once per project
(Auth → Providers → Google → Client ID + Secret), plus `sosial://auth/callback`
in the same allowlist for mobile dev builds. Until then, email sign-in works
and Google fails loudly at the provider step.

## What v1 does

- **Email/password + Google sign-in** on the shared Supabase project. The
  workspace is bootstrapped on first login exactly like mobile.
- **Calendar** — month grid of scheduled `posts`; drag a post to another day to
  reschedule it (keeps the time of day, updates the post and its targets).
- **Composer** — write a post, pick connected channels, attach media, then save
  as a draft, schedule it, or publish now.
- **Queue** — drafts, queued, and sent posts with per-channel result.
- **Channels** — read-only view of the workspace's connected accounts.

## Deploy

Self-hosted: the app ships as a Next.js standalone container (`Dockerfile`)
built on a Linux box and served behind Caddy. See `infra/docker-compose.services.yml`
(`web` service) and `infra/SERVER.md` for the full VPS runbook.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SITE_URL` are **build args** (Next inlines `NEXT_PUBLIC_*`), so a
  change needs a rebuild: `docker compose build web && docker compose up -d web`.
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `RESEND_API_KEY` are runtime env only.
- Health probe: `/api/health`.

Vercel still works (`output: 'standalone'` is ignored there), but is no longer
the production target. If you deploy it, set the project root to `apps/web` and
the same env vars in the Vercel dashboard.

## Notes

- Publishing depends on the worker's channel adapters; if a channel shows
  "expired", reconnect it from the mobile app (web token import is future work).
- Live-photo handling, per-channel formats, and thread chains are mobile-side
  today; the web composer optimizes for the common single-image / text case.
