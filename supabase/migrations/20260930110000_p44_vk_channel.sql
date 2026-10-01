-- P44 · VK channel (community access-key connect, wall.publisher)
--
-- Additive only: one enum value. VK rides the existing posts /
-- post_targets / queue / worker pipeline. The community access key lands
-- in channel_tokens via Vault; the numeric community id is external_id.

alter type provider_key add value if not exists 'vk';
