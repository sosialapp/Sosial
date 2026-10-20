-- p87_user_locales: per-user UI language (8 locales, switches account rows + app copy).
alter table public.profiles add column if not exists locale text not null default 'en';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_locale_check') then
    alter table public.profiles add constraint profiles_locale_check
      check (locale in ('en','es','fr','de','ja','ko','zh'));
  end if;
end $$;
