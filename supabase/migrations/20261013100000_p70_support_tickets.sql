-- p70 · Support tickets: attachments, one-open-ticket rule, user visibility,
-- and 30-day cleanup of solved tickets.
--
-- Model: a report IS a ticket. Users keep exactly one open (or triaged)
-- ticket at a time, the trigger refuses a second until support resolves or
-- closes the first. Users can read their own tickets (status view); admins
-- keep triage control. Solved tickets (resolved/closed) and their uploaded
-- media are purged 30 days after the last update by the report-cleanup
-- edge function (cron sosial-report-cleanup, shares the dormancy token).

alter table reports add column if not exists attachments jsonb not null default '[]';

-- ---- one open ticket per user ---------------------------------------------
create or replace function public.enforce_single_open_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from reports
    where user_id = new.user_id
      and status in ('open', 'triaged')
  ) then
    raise exception 'SUPPORT_TICKET_OPEN: you already have an open ticket';
  end if;
  return new;
end $$;

drop trigger if exists reports_single_open on reports;
create trigger reports_single_open
  before insert on reports
  for each row execute function public.enforce_single_open_report();

-- ---- users see their own tickets -------------------------------------------
create policy "reports_owner_read" on reports for select to authenticated
  using (user_id = auth.uid() or is_app_admin());

-- ---- attachment storage ----------------------------------------------------
insert into storage.buckets (id, name, public)
values ('report-media', 'report-media', false)
on conflict (id) do nothing;

-- Paths are report-media/<user_id>/<uuid>-<file>. Owners control their
-- prefix; app admins can view every attachment while triaging.
drop policy if exists "report_media_owner_insert" on storage.objects;
create policy "report_media_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "report_media_owner_select" on storage.objects;
create policy "report_media_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'report-media' and ((storage.foldername(name))[1] = auth.uid()::text or is_app_admin()));

drop policy if exists "report_media_owner_delete" on storage.objects;
create policy "report_media_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'report-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- daily cleanup of solved tickets (30 days after last update) -----------
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'sosial-report-cleanup') then
    perform cron.schedule(
      'sosial-report-cleanup',
      '40 3 * * *',
      $job$
        select net.http_post(
          url := (select value from private.integration_keys where name = 'edge_base_url') || '/functions/v1/report-cleanup',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (select value from private.integration_keys where name = 'dormancy_token'),
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb
        );
      $job$
    );
  end if;
end $$;
