-- P17 · Threaded post chains: linked segments published as a sequence.
--
-- A chain is N rows in posts sharing one chain_id, ordered by
-- chain_position (0 = lead). Each segment keeps its own targets +
-- schedule, staggered at compose time, so the existing minutely cron
-- (enqueue_due_posts) and the worker publish the chain in order with
-- zero worker changes — a failed segment never blocks its siblings.
-- RLS/grants ride on the existing posts policies (same table).

alter table posts
  add column if not exists chain_id uuid,
  add column if not exists chain_position integer not null default 0;

create index if not exists posts_chain_idx on posts (chain_id, chain_position);
