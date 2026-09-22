-- P14 · Table privileges for blog_posts (fixes 401-everywhere on /blog).
--
-- Root cause (verified from the PostgREST payload): tables created by db push
-- carry grants to `authenticated` only (see P6). The P12 policy
-- blog_public_read opens published rows `to anon`, but without the table
-- privilege PostgREST fails with 42501 "permission denied for table
-- blog_posts" (hint: GRANT SELECT ... TO anon) before RLS is even reached.
-- Rule of thumb: any table the public site reads needs an explicit anon grant.
grant select on blog_posts to anon;
grant select, insert, update, delete on blog_posts to authenticated;
