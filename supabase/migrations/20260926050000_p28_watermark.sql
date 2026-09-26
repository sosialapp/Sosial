-- p28 · Watermark preference + enforcement.
--
-- The Sosial watermark is composited SERVER-SIDE at export/publish time so it
-- can never be stripped with browser devtools. This migration stores the
-- per-workspace choice (paid users control it; free is locked ON) and forces
-- it back on for any plan whose `watermark_required` flag is true, so a
-- downgraded workspace can't leave the switch off.

alter table public.workspaces
  add column if not exists show_watermark boolean not null default true;

-- Free (and any watermark-required plan) always has it on — flip the switch
-- back whenever a write tries to turn it off.
create or replace function public.enforce_watermark_required()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.plan_limits
    where plan = public.workspace_plan(new.id) and watermark_required
  ) then
    new.show_watermark := true;
  end if;
  return new;
end $$;

drop trigger if exists workspaces_watermark_required on public.workspaces;
create trigger workspaces_watermark_required
  before insert or update on public.workspaces
  for each row execute function public.enforce_watermark_required();
