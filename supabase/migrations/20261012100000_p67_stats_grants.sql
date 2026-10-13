-- p67, analytics stats grants.
-- The p4x analytics migrations created member-read RLS policies on
-- post_stats / channel_stats but never GRANTed privileges to `authenticated`
-- (same defect class as p66/reports). Mobile analytics (cloudAnalytics.ts)
-- reads both with the user's JWT, so every analytics request failed with
-- "permission denied for table post_stats". Policies still scope rows to the
-- caller's workspaces; this only restores the table privilege.
-- NOT granted: usage_counters (web reads it via the service-role admin
-- client; members never query it directly).

grant select on public.post_stats, public.channel_stats to authenticated;
