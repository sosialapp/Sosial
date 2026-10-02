-- P46 · Google Business Profile channel (OAuth, per-location local posts)
--
-- Additive only: one enum value. GBP rides the existing posts / post_targets
-- / queue / worker pipeline. Google OAuth tokens land in channel_tokens via
-- Vault; each Business Profile location is its own row (external_id =
-- accounts/{a}/locations/{l}).

alter type provider_key add value if not exists 'gmb';
