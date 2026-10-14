-- p72 · Team profile pictures.
--
-- workspaces.avatar_url points at avatars/teams/<workspace_id>/pfp.jpg in
-- the private `avatars` bucket. Writes go through the team-avatar edge
-- function (owner/admin only), which compresses server-side exactly like
-- profile pictures. Any workspace member can read their team's picture;
-- clients use signed URLs.

alter table workspaces add column if not exists avatar_url text;

drop policy if exists "avatars_team_member_read" on storage.objects;
create policy "avatars_team_member_read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'teams'
    and is_workspace_member(((storage.foldername(name))[2])::uuid));
