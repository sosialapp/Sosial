-- P83 · Per-user announcement dismissal + bell delete.
--
-- `notifications` rows are per-recipient, and notifications_owner_all (P48)
-- already allows the owner to delete them. Announcements are app-wide, so
-- "delete" can only hide the broadcast for the user who pressed it; the
-- dismissal state lives on the existing per-user read row.
alter table public.announcement_reads
  add column if not exists dismissed_at timestamptz;

grant select, insert, update, delete on public.announcement_reads to authenticated;
