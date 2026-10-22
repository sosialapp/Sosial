-- Meta Send API addresses the person, not the thread: Messenger needs the
-- PSID and Instagram the IGSID. Keep it on the conversation so sends survive
-- reconnects (X/Bluesky/Mastodon already use the other user's id as
-- external_id, the backfill mirrors that).
alter table public.conversations
  add column if not exists participant_external_id text;

update public.conversations
set participant_external_id = external_id
where participant_external_id is null
  and platform in ('x', 'bluesky', 'mastodon');

-- Webhook subscription runs as a worker job so it uses the Vault token and
-- never blocks the OAuth import.
alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check check (
  kind in (
    'publish_target','refresh_token','snapshot_analytics','cleanup_media',
    'send_invite','sync_avatars','send_push','delete_post_target',
    'sync_inbox','sync_comments','send_message','reply_comment',
    'meta_subscribe'
  )
);
