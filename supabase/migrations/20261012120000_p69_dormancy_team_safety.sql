-- p69 · Dormancy team safety
--
-- A user is only a dormancy candidate when they are personally idle AND
-- every workspace they belong to is idle. "Workspace idle" = no post created
-- in it AND no active member signed in, within the window. So a dormant
-- owner whose teammates still sign in or post keeps the whole team (and its
-- data) alive; the team is only swept when everyone has been gone 6 months.
--
-- The previous definition looked only at the user's own sign-in and posts in
-- their workspaces, so a free team whose members logged in daily but had not
-- posted in 6 months could be deleted out from under them.

create or replace function public.dormancy_candidates(
  p_idle_before timestamptz,
  p_limit int default 20
)
returns table (id uuid, email text, last_sign_in_at timestamptz, warned_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.email,
    u.last_sign_in_at,
    (u.raw_user_meta_data ->> 'dormancy_warned_at')::timestamptz as warned_at
  from auth.users u
  where coalesce(
          greatest(
            u.last_sign_in_at,
            -- Latest activity across every workspace this user belongs to:
            -- any post, or any active member's sign-in. A live teammate
            -- keeps the whole workspace, and everyone in it, off the list.
            (
              select max(ws.activity)
              from (
                select greatest(
                  (select max(p.created_at)
                     from posts p
                    where p.workspace_id = wm.workspace_id),
                  (select max(au.last_sign_in_at)
                     from workspace_members wm2
                     join auth.users au on au.id = wm2.user_id
                    where wm2.workspace_id = wm.workspace_id
                      and wm2.status = 'active')
                ) as activity
                from workspace_members wm
                where wm.user_id = u.id
                  and wm.status = 'active'
              ) ws
            )
          ),
          u.created_at
        ) < p_idle_before
    -- members of workspaces with a live subscription are never dormancy targets
    and not exists (
      select 1
      from workspace_members wm3
      join subscriptions s on s.workspace_id = wm3.workspace_id
      where wm3.user_id = u.id
        and s.status in ('active', 'trialing')
        and s.stripe_subscription_id is not null
    )
  order by u.created_at asc
  limit p_limit;
$$;

revoke all on function public.dormancy_candidates(timestamptz, int) from public, anon, authenticated;
