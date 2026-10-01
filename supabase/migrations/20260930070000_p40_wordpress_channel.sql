-- P40 · WordPress channel (Phase 1 integration #3)
--
-- Additive only: one enum value. WordPress rides the existing posts /
-- post_targets / queue / worker pipeline. Per-site Application Password
-- lands in channel_tokens via Vault; the site URL lives on
-- connected_channels.instance_url (username in metadata).

alter type provider_key add value if not exists 'wordpress';
