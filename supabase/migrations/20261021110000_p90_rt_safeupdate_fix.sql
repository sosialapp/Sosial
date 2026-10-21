-- p90_rt_safeupdate_fix: hotfix for p88's bare `delete from pg_temp._post_targets_snapshot`.
-- pg-safeupdate rejects DELETE without WHERE, so that statement aborted the
-- whole posts-delete transaction with "DELETE requires a WHERE clause" —
-- drafts (and every post) became undeletable through the UI. Recreate only
-- the enqueue function with a WHERE-prefixed consume; trigger wiring in p88
-- points at the same function name and needs no change.

create or replace function public.enqueue_remote_deletes_after()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if to_regclass('pg_temp._post_targets_snapshot') is null then
    return null;
  end if;
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  select 'delete_post_target',
         jsonb_build_object('post_target_id', s.post_target_id),
         now(),
         'delete_post_target:' || s.post_target_id::text
  from pg_temp._post_targets_snapshot s
  on conflict (idempotency_key) do nothing;
  -- Consume the snapshot rows so batch deletes don't double-enqueue. WHERE is
  -- required by pg-safeupdate, which rejects bare DELETEs project-wide.
  delete from pg_temp._post_targets_snapshot where post_target_id is not null;
  return null;
end;
$$;
