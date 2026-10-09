-- P61 · Delete post → sweep its media (object + row) from R2.
--
-- User choice: deleting a post in Sosial removes its media too. The worker's
-- cleanup_media job already performs object-first, idempotent deletes
-- (storageRemove → deleteMediaAsset); this migration is the missing enqueue.
--
-- Ordering caveat: post_media rows cascade away DURING the posts delete, so an
-- AFTER DELETE trigger can no longer tell which assets belonged to the post.
-- A BEFORE trigger therefore snapshots the asset ids into a per-transaction
-- temp table, and the AFTER row trigger enqueues one cleanup_media job per
-- asset that has NO remaining post_media link (media attached to another post
-- is never swept). Jobs are idempotent by asset id, worker-side deletes are
-- idempotent — double-enqueue or crash-retry can never orphan or double-hit.

create or replace function public.snapshot_post_media_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  create temp table if not exists _post_media_snapshot (
    post_id uuid not null,
    media_id uuid not null
  ) on commit drop;
  insert into _post_media_snapshot (post_id, media_id)
  select post_id, media_id from public.post_media where post_id = old.id;
  return old;
end;
$$;

create or replace function public.enqueue_media_cleanup_on_post_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if to_regclass('pg_temp._post_media_snapshot') is null then
    return null; -- post had no media
  end if;
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  select 'cleanup_media',
         jsonb_build_object('media_id', s.media_id),
         now(),
         'cleanup_media:' || s.media_id::text
  from pg_temp._post_media_snapshot s
  where s.post_id = old.id
    -- keep media still attached to any surviving post
    and not exists (select 1 from public.post_media pm where pm.media_id = s.media_id)
  on conflict (idempotency_key) do nothing;
  -- Consume this post's snapshot rows so batch deletes don't double-process.
  delete from pg_temp._post_media_snapshot where post_id = old.id;
  return null;
end;
$$;

drop trigger if exists trg_posts_media_snapshot on public.posts;
create trigger trg_posts_media_snapshot
  before delete on public.posts
  for each row
  execute function public.snapshot_post_media_on_delete();

drop trigger if exists trg_posts_media_cleanup on public.posts;
create trigger trg_posts_media_cleanup
  after delete on public.posts
  for each row
  execute function public.enqueue_media_cleanup_on_post_delete();
