-- P45 · Reddit channel (OAuth connect, per-subreddit rows, self-post publish)
--
-- Additive only: one enum value. Reddit rides the existing posts /
-- post_targets / queue / worker pipeline. Tokens land in channel_tokens via
-- Vault (permanent refresh token); each connected subreddit is its own row
-- (external_id u/{user}/r/{sr}) so the queue needs no new fields.

alter type provider_key add value if not exists 'reddit';
