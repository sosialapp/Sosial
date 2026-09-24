# sosial-worker

Long-running publish worker (Railway). Claims jobs from Supabase `job_queue`
via the `claim_job` / `complete_job` RPCs (see
`supabase/migrations/20260917000003_p3_worker_rpc.sql`) and runs them.

Near-dependency-free: plain Node 20 `fetch`, no pg driver, no framework —
plus `sharp` for server-side image normalization (same ladder as the app).
SKIP LOCKED lives in SQL so multiple replicas never double-claim.

## Run locally

```powershell
Copy-Item apps/worker/.env.example apps/worker/.env  # fill staging values
npm run build --prefix apps/worker   # or: npx tsc -p apps/worker
node apps/worker/dist/index.js
```

`npm run typecheck --prefix apps/worker` must stay clean.

## Contract (frozen by the P2/P3 migrations)

- `claim_job(worker_id)` — oldest due `queued` job as `running`, else null.
- `complete_job(job_id, ok, err)` — `done`, or requeue with exponential
  backoff (`dead` when attempts run out).
- `enqueue_due_posts()` (pg_cron, every minute) feeds `publish_target` jobs
  with `idempotency_key = 'publish_target:<target_id>'`.
- `enqueue_expiring_tokens()` (pg_cron, every 15 min) feeds `refresh_token`
  jobs for channels expiring within the hour (P18).
- `enqueue_daily_snapshots()` (pg_cron, daily 05:20 UTC) feeds
  `snapshot_analytics` jobs — one per connected channel per day (P19).
- `unique(post_targets.post_id, channel_id)` is the double-post guard.

## Implemented job kinds

- `publish_target` — all ten providers (Facebook, Instagram, Threads, X,
  Bluesky, Mastodon, LinkedIn, YouTube, TikTok, Pinterest), text + photo +
  video, threads as reply chains where the platform supports them.
- `refresh_token` — proactive rotation for tiktok/x/linkedin/pinterest/
  youtube/bluesky; auth-dead channels are marked `expired` for reconnect.
- `snapshot_analytics` — per-post engagement (likes/comments/shares/views)
  pulled by remote id into `post_stats` for every provider that exposes a
  read API (TikTok has none and is skipped as a no-op).
- `sync_avatars`, `send_push`, `send_invite`.

Only `cleanup_media` remains a stub.

## Deploy (Railway, when ready)

New service from `apps/worker`, start command `node dist/index.js`
(run `npm run build` first or as the build command), env:
`WORKER_SUPABASE_URL` + `WORKER_SERVICE_ROLE_KEY` from the **staging**
project. Service-role key never leaves the server.
