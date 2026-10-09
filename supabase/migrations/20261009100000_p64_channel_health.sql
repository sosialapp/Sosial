-- P64 · Channel health RPC: expiry truth for clients.
--
-- connected_channels.status only flips to 'expired' when the worker's refresh
-- proves auth-dead. But a channel can be silently broken while still
-- 'connected': its token expiry passed and refresh keeps failing for other
-- reasons (e.g. missing OAuth client keys on the worker). Clients cannot read
-- channel_tokens directly (no RLS surface there by design), so this RPC
-- exposes exactly one derived bit per channel: token_stale (expiry older than
-- 1h — the hourly refresh cron had its chance). Clients treat
-- status='expired' OR token_stale as "needs reconnect".

create or replace function public.channel_health(p_workspace_id uuid)
returns table (
  channel_id uuid,
  provider text,
  external_id text,
  status text,
  last_error text,
  token_stale boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select cc.id,
         cc.provider::text,
         cc.external_id,
         cc.status::text,
         cc.last_error,
         coalesce(ct.expires_at < now() - interval '1 hour', false)
  from public.connected_channels cc
  left join public.channel_tokens ct on ct.channel_id = cc.id
  where cc.workspace_id = p_workspace_id
    and public.is_workspace_member(p_workspace_id);
$$;

revoke all on function public.channel_health(uuid) from public, anon;
grant execute on function public.channel_health(uuid) to authenticated;
