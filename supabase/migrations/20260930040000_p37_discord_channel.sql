-- P37 · Discord channel (Phase 1 integration #2)
--
-- Additive only: one enum value. Discord rides the existing posts /
-- post_targets / queue / worker pipeline. The bot token lands in
-- channel_tokens via Vault; the destination channel id lives on
-- connected_channels.external_id (guild + channel names in metadata).

alter type provider_key add value if not exists 'discord';
