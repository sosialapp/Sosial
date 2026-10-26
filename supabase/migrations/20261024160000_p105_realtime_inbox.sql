-- p105: publish the inbox/publish tables to Supabase Realtime.
--
-- Every surface that shows comments, DMs or post status learned about new
-- rows by re-querying: web polled comments every 20s (visible tabs only),
-- mobile only on mount or pull-to-refresh, and Messages had no recurring
-- refresh at all. That meant a comment the sweep had already stored could sit
-- invisible for up to 20s on web and indefinitely on mobile.
--
-- The Realtime container was never in the stack and the publication was empty,
-- so there was nothing to subscribe to. The gateway (Envoy) has always routed
-- /realtime/v1/ to it, so enabling it is a publication change plus the
-- container itself.
--
-- Rows are delivered per subscriber, filtered by the same RLS the client
-- already passes for its own SELECTs, so no new exposure: a user only sees
-- changes to rows they can read. The subscription filters on workspace_id,
-- which matches the existing select policies.
--
-- max_slot_wal_keep_size is already 512MB on this database, which bounds the
-- one real cost of a logical slot (retained WAL if a consumer dies).

do $$
declare
  t text;
  tables text[] := array[
    'comments',
    'conversations',
    'messages',
    'posts',
    'post_targets',
    'notifications'
  ];
begin
  -- Publication is created by the Supabase init scripts, but guard anyway so
  -- this migration is safe on a database that was initialised differently.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array tables loop
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t
    ) and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- Delete/update payloads need the whole old row for RLS to be evaluated, and
-- a purge or a disconnect can remove a row the client is watching. Replica
-- identity full is the documented requirement for those payloads.
alter table public.comments replica identity full;
alter table public.conversations replica identity full;
alter table public.messages replica identity full;
alter table public.posts replica identity full;
alter table public.post_targets replica identity full;
alter table public.notifications replica identity full;