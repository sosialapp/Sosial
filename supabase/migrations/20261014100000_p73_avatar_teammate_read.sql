-- p73 · Teammates can view each other's profile pictures.
--
-- Member roster avatars (web Team page, mobile Team screen) need signed
-- URLs for teammates' prefixes. The owner policy only covers your own
-- prefix, so without this every roster falls back to initials. Scoped to
-- people who share an active workspace with you — never public.

drop policy if exists "avatars_teammate_read" on storage.objects;
create policy "avatars_teammate_read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars'
    and (storage.foldername(name))[1] <> 'teams'
    and exists (
      select 1
      from workspace_members m1
      join workspace_members m2 on m1.workspace_id = m2.workspace_id
      where m1.user_id = auth.uid() and m1.status = 'active'
        and m2.user_id = ((storage.foldername(name))[1])::uuid
        and m2.status = 'active'
    ));
