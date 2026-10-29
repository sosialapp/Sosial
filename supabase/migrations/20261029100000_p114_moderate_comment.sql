-- p114: hide / unhide comments from the Community feed.
--
-- Facebook Pages (pages_manage_engagement) and Instagram
-- (instagram_business_manage_comments) both let the account owner hide a
-- comment from the public. The moderate-comment edge function gates the
-- caller and queues a moderate_comment job; the worker calls the platform
-- and moves the row to 'hidden' (or back to 'new' on unhide).

alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check check (
  kind in (
    'publish_target','refresh_token','snapshot_analytics','cleanup_media',
    'send_invite','sync_avatars','send_push','delete_post_target',
    'sync_inbox','sync_comments','send_message','reply_comment',
    'meta_subscribe','moderate_comment'
  )
);

create or replace function public.enqueue_moderate_comment(p_channel uuid, p_comment uuid, p_hide boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  values (
    'moderate_comment',
    jsonb_build_object(
      'channel_id', p_channel,
      'comment_id', p_comment,
      'hide', coalesce(p_hide, true)
    ),
    now(),
    'moderate_comment:' || gen_random_uuid()::text
  );
end;
$$;

revoke all on function public.enqueue_moderate_comment(uuid, uuid, boolean) from public;
revoke all on function public.enqueue_moderate_comment(uuid, uuid, boolean) from anon, authenticated;
grant execute on function public.enqueue_moderate_comment(uuid, uuid, boolean) to service_role;
