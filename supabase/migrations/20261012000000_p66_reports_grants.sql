-- p66 — reports table grants (support form fix).
-- p11 created `reports` + RLS policies but never GRANTed anything to
-- `authenticated`, so every support insert from web AND mobile failed with
-- "permission denied for table reports". RLS policies still scope access:
-- members may only insert rows with their own user_id; only app admins
-- may read/update.

grant select, insert, update on public.reports to authenticated;
