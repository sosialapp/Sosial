-- p56 · Storage backend switch (Supabase Storage → Cloudflare R2).
--
-- media_assets.storage_path keeps its exact logical key
-- (<workspace_id>/<client_id>/<index>-<stamp>.<ext>); only WHERE the bytes live
-- changes. storage_backend records that:
--   'supabase' — bytes only in the post-media bucket (legacy / not yet moved)
--   'r2'       — bytes only in R2 (sosial-media/post-media/<storage_path>)
--   'both'     — dual-written during the transition (reads prefer R2)
-- Reads prefer R2 whenever the flag allows and fall back to Supabase on miss,
-- so this is safe to ship before the backfill finishes. Blog media keeps its own
-- public bucket/prefix and is not tracked here.

alter table public.media_assets
  add column if not exists storage_backend text not null default 'supabase'
    check (storage_backend in ('supabase', 'r2', 'both'));

-- Backfill sweep: find assets whose bytes still need (re)writing to R2.
create index if not exists media_assets_backend_idx
  on public.media_assets (storage_backend)
  where storage_backend <> 'r2';
