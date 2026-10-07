-- P52: OneDrive joins media_integrations (composer media sources).
alter table public.media_integrations
  drop constraint if exists media_integrations_provider_check;
alter table public.media_integrations
  add constraint media_integrations_provider_check
  check (provider in ('google', 'dropbox', 'canva', 'onedrive'));
