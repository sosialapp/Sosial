-- p109 -- the active team follows the account, not the device.
--
-- Web kept the active workspace in the sosial_ws cookie, the phone kept it in
-- SecureStore (sosial_ws_id), and nothing reconciled the two. Both clients read
-- the same tables with the same queries, so a stale pin could only ever show up
-- as "the phone has fewer comments than the web" -- same database, different
-- workspace_id.
--
-- profiles is the natural home: it already holds per-user prefs (locale,
-- notification flags) and already has the own-row policy profiles_self_all
-- (id = uid()), so both clients can read and write their own row without a new
-- policy or a new table.
--
-- Precedence after this migration: account column first, device pin second.
-- The pin is not removed -- it still covers a cold start with no network, which
-- is exactly when a profile read fails.
--
-- on delete set null: deleting a team must not brick the profile row. Existing
-- rows stay NULL and fall back to the pin, so this is a no-op on rollout.

alter table public.profiles
  add column if not exists active_workspace_id uuid
  references public.workspaces(id) on delete set null;

comment on column public.profiles.active_workspace_id is
  'Last team the user actively switched to. Read by web (getWorkspaceContext) and mobile (myWorkspace) so both clients agree; the per-device pin is only the offline fallback.';
