-- P43 · Ghost channel (Phase 1 integration #6, last one)
--
-- Additive only: one enum value. Ghost rides the existing posts /
-- post_targets / queue / worker pipeline. The Admin API key lands in
-- channel_tokens via Vault; the site URL is the external_id.

alter type provider_key add value if not exists 'ghost';
