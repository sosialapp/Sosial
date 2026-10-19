-- P81 · Per-channel invites.
--
-- Invites carried only an all_channels flag, so an owner could not scope a
-- teammate to specific accounts up front, they had to invite with "all" and
-- edit grants afterwards. Add a providers array to invites and apply it as
-- member_channel_grants on accept, mirroring set_member_grants (providers are
-- ignored when all_channels is true; grants are replaced, not merged).

alter table public.invites
  add column if not exists providers provider_key[] not null default '{}';

-- create_invite gains p_providers. The signature changes, so drop the 4-arg
-- version, PostgREST resolves RPCs by argument name and two overloads would
-- be ambiguous for the existing 4-arg callers.
drop function if exists public.create_invite(uuid, text, team_role, boolean);

create or replace function public.create_invite(
  p_workspace_id uuid,
  p_email text,
  p_role team_role default 'member',
  p_all_channels boolean default false,
  p_providers provider_key[] default '{}'
)
returns invites
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_row invites%rowtype;
  v_providers provider_key[] := coalesce(p_providers, '{}');
begin
  if v_email = '' or v_email not like '%@%.%' then
    raise exception 'Enter a valid email address.';
  end if;
  if p_role = 'owner' then
    raise exception 'Cannot invite another owner.';
  end if;
  if not (
    workspace_role(p_workspace_id) in ('owner', 'admin')
    or p_workspace_id in (select id from workspaces where owner_id = auth.uid())
  ) then
    raise exception 'Only owners and admins can invite.';
  end if;
  -- Refresh a pending invite for the same email instead of duplicating.
  select * into v_row from invites
   where workspace_id = p_workspace_id
     and lower(email) = v_email
     and accepted_at is null
   order by created_at desc
   limit 1;
  if found then
    update invites
       set role = p_role,
           all_channels = p_all_channels,
           providers = v_providers,
           expires_at = now() + interval '7 days',
           invited_by = auth.uid(),
           emailed_at = null
     where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;
  insert into invites (workspace_id, email, role, all_channels, providers, invited_by)
  values (p_workspace_id, v_email, p_role, p_all_channels, v_providers, auth.uid())
  returning * into v_row;
  return v_row;
end $$;

-- accept_invite now seeds provider grants from the invite. Signature is
-- unchanged, so replacing keeps the existing grants to authenticated.
create or replace function public.accept_invite(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv invites%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  select * into v_inv from invites where token = p_token;
  if not found then
    raise exception 'Invite not found.';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Invite already accepted.';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Invite expired.';
  end if;
  if lower(v_inv.email) != v_email or v_email = '' then
    raise exception 'This invite was sent to a different email address.';
  end if;
  insert into workspace_members (workspace_id, user_id, email, role, status, all_channels)
  values (v_inv.workspace_id, auth.uid(), v_inv.email, v_inv.role, 'active', v_inv.all_channels)
  on conflict (workspace_id, email) do update set
    user_id = excluded.user_id,
    role = excluded.role,
    status = 'active',
    all_channels = excluded.all_channels
  returning id into v_member_id;
  -- Replace grants to match the invite exactly (a re-invited member should not
  -- keep stale access); providers are ignored when the invite grants all.
  delete from member_channel_grants where member_id = v_member_id;
  if not v_inv.all_channels and coalesce(cardinality(v_inv.providers), 0) > 0 then
    insert into member_channel_grants (member_id, provider)
    select v_member_id, unnest(v_inv.providers)
    on conflict do nothing;
  end if;
  update invites set accepted_at = now() where id = v_inv.id;
  return v_inv.workspace_id;
end $$;

revoke all on function public.create_invite(uuid, text, team_role, boolean, provider_key[]) from public;
grant execute on function public.create_invite(uuid, text, team_role, boolean, provider_key[]) to authenticated;
