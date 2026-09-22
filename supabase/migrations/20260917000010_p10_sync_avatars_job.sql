-- P10 · sync_avatars job kind
--
-- The worker now backfills connected-channel profile pictures server-side
-- (token lives in Vault, so no mobile app is needed). That job runs through
-- job_queue, whose kind CHECK constraint must list it.

alter table job_queue drop constraint if exists job_queue_kind_check;
alter table job_queue add constraint job_queue_kind_check
  check (kind in (
    'publish_target',
    'refresh_token',
    'snapshot_analytics',
    'cleanup_media',
    'send_invite',
    'sync_avatars'
  ));
