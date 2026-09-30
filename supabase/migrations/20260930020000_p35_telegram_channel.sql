-- P35 · Telegram channel (Phase 1 integration #1)
--
-- Additive only: one enum value. Telegram rides the existing posts /
-- post_targets / queue / worker pipeline — no new tables, no new RPCs, no
-- second scheduler. The bot token lands in channel_tokens via Vault exactly
-- like every other provider; the destination chat id lives on
-- connected_channels.external_id (display name in display_name/handle).

alter type provider_key add value if not exists 'telegram';
