-- p71 · User profile pictures.
--
-- profiles.avatar_url points at an object in the private `avatars` bucket
-- (path avatars/<user_id>/pfp.jpg). Writes go through the profile-avatar
-- edge function, which compresses to ≤256px WebP/JPEG server-side so a
-- profile picture costs a few KB, not megabytes. Google sign-ins capture
-- the Google account picture the same way (first sign-in / on demand).
-- Clients read via signed URLs (createSignedUrl), so no public bucket.

alter table profiles add column if not exists avatar_url text;

-- Private bucket; one prefix per user.
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', false, 5242880)
on conflict (id) do nothing;

-- Only the edge function (service role) writes; users read their own prefix.
drop policy if exists "avatars_owner_read" on storage.objects;
create policy "avatars_owner_read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
