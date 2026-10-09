-- P59 · Publish bundle carries media size + duration
--
-- Publish-time per-platform guards need the real byte size (YouTube ≤10 GB,
-- other video ≤1 GB, images ≤10 MB) and duration (YouTube ≤4 h). The bundle
-- previously stopped at storage_path/kind/mime — the worker had to download
-- bytes to learn the size. byte_size is written by the media edge function on
-- upload; legacy rows may be NULL (guards fall back to a storage HEAD).

create or replace function get_publish_bundle(target_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  out jsonb;
begin
  select jsonb_build_object(
    'target', jsonb_build_object(
      'id', pt.id, 'provider', pt.provider, 'caption', pt.caption,
      'options', pt.options, 'idempotency_key', pt.idempotency_key,
      'status', pt.status
    ),
    'post', jsonb_build_object(
      'id', p.id, 'title', p.title, 'body', p.body, 'workspace_id', p.workspace_id
    ),
    'media', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'storage_path', ma.storage_path, 'kind', ma.kind,
          'mime_type', ma.mime_type, 'position', pm.position,
          'byte_size', ma.byte_size, 'duration_ms', ma.duration_ms
        )
        order by pm.position
      )
      from post_media pm
      join media_assets ma on ma.id = pm.media_id
      where pm.post_id = p.id
    ), '[]'::jsonb),
    'channel', jsonb_build_object(
      'id', cc.id, 'provider', cc.provider, 'external_id', cc.external_id,
      'instance_url', cc.instance_url, 'metadata', cc.metadata
    ),
    'secrets', jsonb_build_object(
      'access_secret_id', ct.access_token_secret_id,
      'refresh_secret_id', ct.refresh_token_secret_id,
      'expires_at', ct.expires_at
    )
  )
  into out
  from post_targets pt
  join posts p on p.id = pt.post_id
  join connected_channels cc on cc.id = pt.channel_id
  left join channel_tokens ct on ct.channel_id = cc.id
  where pt.id = target_id;
  return out;
end $$;

revoke all on function get_publish_bundle(uuid) from public, anon, authenticated;
grant execute on function get_publish_bundle(uuid) to service_role;
