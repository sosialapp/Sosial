-- p57 · Media retention reversal: media is now retained PERMANENTLY.
--
-- The p55 janitor expired media bytes after a plan window (Free 30d · Solo
-- 90d · Team 180d · Business 365d). That policy is removed: uploaded media is
-- kept for the life of the workspace and never auto-deleted. This forward
-- migration (p55 is already recorded in remote history — never edit it)
-- unschedules the cron, drops the expiry logic, and removes the per-plan
-- retention column.
--
-- Kept:
--   * media_assets.pinned — harmless safety flag; no expiry reads it now.
--   * the cleanup_media job kind — still used for explicit user deletes and
--     abandoned/failed uploads (see apps/worker/src/dispatch.ts).
--   * purge_expired_media() (p5) — clears rows that never reached 'ready'.
--
-- Storage is bounded by plan_limits.storage_bytes (p58) instead of by time.

-- 1. Stop the daily expiry sweep.
do $$
begin
  perform cron.unschedule('sosial-enqueue-media-cleanup');
exception
  when others then null; -- job/proc may be absent on a fresh DB
end $$;

-- 2. Drop the expiry functions (CASCADE clears any dependent grants).
drop function if exists public.enqueue_expired_media_cleanup();
drop function if exists public.workspace_media_retention_days(uuid);

-- 3. Drop the expiry index (only ever used by the deleted sweep).
drop index if exists public.media_assets_retention_idx;

-- 4. Remove the per-plan retention window.
alter table public.plan_limits
  drop column if exists media_retention_days;
