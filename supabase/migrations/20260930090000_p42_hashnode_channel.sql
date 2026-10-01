-- P42 · Hashnode channel (Phase 1 integration #5)
--
-- Additive only: one enum value. Hashnode rides the existing posts /
-- post_targets / queue / worker pipeline. The Personal Access Token lands
-- in channel_tokens via Vault; the publication id is the external_id.

alter type provider_key add value if not exists 'hashnode';
