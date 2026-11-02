-- p119: post_stats counts only what the AUDIENCE does to our posts.
--
-- Saves and clicks were folded into likes/shares (Pinterest saves read as
-- likes, Pinterest and Google Business clicks read as shares), and our own
-- replies, self-likes and self-reposts were counted as engagement. The worker
-- now strips our own actions and stores saves and clicks in their own
-- columns; interactions = likes + comments + shares + saves + clicks
-- (apps/web/src/lib/analyticsMath.ts, mirrored at src/utils/analyticsMath.ts).

alter table public.post_stats add column if not exists saves integer not null default 0;
alter table public.post_stats add column if not exists clicks integer not null default 0;

-- Rows written before this change keep the old mapping until the next daily
-- snapshot (or an on-demand analytics refresh) rewrites them.
