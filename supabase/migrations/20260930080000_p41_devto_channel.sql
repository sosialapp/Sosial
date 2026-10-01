-- P41 · Dev.to channel (Phase 1 integration #4)
--
-- Additive only: one enum value. Dev.to rides the existing posts /
-- post_targets / queue / worker pipeline. The API key lands in
-- channel_tokens via Vault; the Dev.to username is the external_id.

alter type provider_key add value if not exists 'devto';
