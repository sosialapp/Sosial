# `@sosial/core`

Shared, dependency-free helpers (canonical postable channel ids) consumable by
the Expo app, the Next.js web app and the publish worker.

## Status

Scaffolded during P0. Not yet wired into the mobile Metro bundler. Channel ids
are mirrored in `src/utils/managed.ts` by hand.

Plan limits are NOT here. The single source of truth is
`apps/web/src/lib/billing/plans.ts` (mirrored by `src/utils/plans.ts` on mobile
and `public.plan_limits` in the DB for trigger/RPC enforcement) — see
`docs/billing.env.example`. The old `src/entitlements.ts` matrix was removed so
a stale second price book can't drift back in.

## Layout

- `src/channels.ts` — canonical postable `ChannelKey`s + labels.
- `src/index.ts` — barrel.

## Rules

- Pure functions only. No I/O, no `fetch`, no secrets.
- The server enforces limits; clients mirror for UI copy only.
