-- p104 -- disconnecting a channel can now erase it, not just revoke it.
--
-- p102 made disconnect REVOKE the channel row so post cards and analytics kept
-- their destination, and that is still the default. This adds the opt-in
-- opposite: when a user asks for the account to be forgotten entirely, every
-- row that exists only because the account was connected is removed in a single
-- transaction, so the workspace looks exactly as it did before the account was
-- added -- the account was never connected.
--
-- Called only by the remove-channel-token edge function (which does the JWT +
-- owner/admin check) with the service role; execute is revoked from every
-- client role.
--
-- Kept on purpose:
--   media_assets + storage objects + library_items  the files stay in the
--     library; the post-delete media sweep is cancelled inside this txn.
--   posts that still have another destination        only orphaned posts go.
--   community_reads, reports, usage_counters, workspace_api_keys, mcp_logs.
--
-- Deliberately NOT done: remote deletes. The user's real posts stay published
-- on the platform; Sosial only forgets them.

-- ------------------------------------------------------------ preview -------
-- Per-channel counts for the "what will be deleted" warning. Mirrors exactly
-- what purge_channel_data removes.
create or replace function public.channel_purge_counts(p_channel uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'targets', (
      select count(*) from public.post_targets where channel_id = p_channel
    ),
    'scheduled', (
      select count(*) from public.post_targets
      where channel_id = p_channel and status = 'queued'
    ),
    -- Posts this channel is the LAST destination for -- the ones that vanish.
    'posts', (
      select count(*) from public.posts p
      where p.id in (select post_id from public.post_targets where channel_id = p_channel)
        and not exists (
          select 1 from public.post_targets t
          where t.post_id = p.id and t.channel_id <> p_channel
        )
    ),
    'comments', (
      select count(*) from public.comments where channel_id = p_channel
    ),
    'messages', (
      select count(*) from public.messages m
      where m.conversation_id in (
        select id from public.conversations where channel_id = p_channel
      )
    ),
    'conversations', (
      select count(*) from public.conversations where channel_id = p_channel
    ),
    'stats', (
      (select count(*) from public.channel_stats where channel_id = p_channel)
      + (select count(*) from public.channel_stats_history where channel_id = p_channel)
      + (select count(*) from public.post_stats where channel_id = p_channel)
    )
  );
$$;

-- -------------------------------------------------------------- purge -------
create or replace function public.purge_channel_data(p_channel uuid, p_workspace uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ws uuid;
  v_post_ids uuid[];
  v_media_ids uuid[];
  v_jobs integer := 0;
  v_secrets integer := 0;
  v_sec uuid;
  v_counts jsonb;
begin
  select workspace_id into v_ws from public.connected_channels where id = p_channel;
  if v_ws is null then
    return jsonb_build_object('removed', false);
  end if;
  -- The edge function already checked membership; this guards a mismatch
  -- between the id and the workspace claimed for it.
  if v_ws <> p_workspace then
    raise exception 'channel_workspace_mismatch' using errcode = '42501';
  end if;

  v_counts := public.channel_purge_counts(p_channel);

  -- Posts reachable through this channel's destinations, and the media those
  -- posts carry -- captured before the delete cascades eat the link rows.
  select coalesce(array_agg(distinct post_id), '{}'::uuid[])
    into v_post_ids
    from public.post_targets
   where channel_id = p_channel;

  select coalesce(array_agg(distinct media_id), '{}'::uuid[])
    into v_media_ids
    from public.post_media
   where post_id = any(v_post_ids);

  -- 1. Queue rows that point at anything about to disappear: channel crons and
  --    refreshes, analytics, inbox/comment syncs, sends and replies.
  delete from public.job_queue
   where payload->>'channel_id' = p_channel::text
      or payload->>'post_target_id' in (
        select id::text from public.post_targets where channel_id = p_channel
      )
      or payload->>'conversation_id' in (
        select id::text from public.conversations where channel_id = p_channel
      )
      or payload->>'comment_id' in (
        select id::text from public.comments where channel_id = p_channel
      );
  get diagnostics v_jobs = row_count;

  -- 2. Vault secrets. channel_tokens cascades off the channel row, but the
  --    secrets live outside it, so collect their ids before the row is gone.
  for v_sec in
    select access_token_secret_id as id from public.channel_tokens
     where channel_id = p_channel and access_token_secret_id is not null
    union all
    select refresh_token_secret_id from public.channel_tokens
     where channel_id = p_channel and refresh_token_secret_id is not null
  loop
    perform public.vault_delete_secret(v_sec);
    v_secrets := v_secrets + 1;
  end loop;

  -- 3. platform_comments only NULLs its channel_id on cascade, which would
  --    leave orphan rows behind -- remove them explicitly.
  delete from public.platform_comments where channel_id = p_channel;

  -- 4. Destinations (post_stats and platform_comments cascade from here).
  --    Deleting targets directly never enqueues a remote delete, so the real
  --    posts stay live on the platform.
  delete from public.post_targets where channel_id = p_channel;

  -- 5. Posts this channel was the last destination for. Their media stays: the
  --    post-delete trigger enqueues cleanup_media, cancelled in step 6.
  delete from public.posts p
   where p.id = any(v_post_ids)
     and not exists (select 1 from public.post_targets t where t.post_id = p.id);

  -- 6. Cancel the media sweeps step 5 just enqueued so the library keeps its
  --    files. Same transaction, so the worker never sees these jobs.
  delete from public.job_queue
   where kind = 'cleanup_media'
     and idempotency_key in (
       select 'cleanup_media:' || m::text from unnest(v_media_ids) as m
     );

  -- 7. The channel row. channel_messages, channel_stats, channel_stats_history,
  --    channel_tokens, comment_posts, comments, conversations (with their
  --    messages) and member_account_grants all cascade from here.
  delete from public.connected_channels where id = p_channel;

  return v_counts || jsonb_build_object(
    'removed', true,
    'jobs', v_jobs,
    'secrets', v_secrets
  );
end $$;

-- Edge-function only: the caller does its own auth and runs as service_role.
revoke all on function public.channel_purge_counts(uuid) from public, anon, authenticated;
revoke all on function public.purge_channel_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.channel_purge_counts(uuid) to service_role;
grant execute on function public.purge_channel_data(uuid, uuid) to service_role;