-- P79 · Function privilege hardening.
--
-- These migrations create functions with `grant execute … to public` (or rely on
-- PostgreSQL's built-in default, EXECUTE to PUBLIC). `revoke … from public`
-- was only applied to some of them, so the rest stayed callable by anyone:
-- `anon` and `authenticated` both inherit PUBLIC, and the anon key ships in the
-- browser bundle. That made these reachable from an unauthenticated PostgREST
-- request:
--
--   notif_insert(ws, user, kind, title, body, href)  ← no auth check at all;
--     anyone could inject notifications into any workspace (phishing/abuse).
--   notif_admins(ws)        leaks the admin user ids of any workspace.
--   is_workspace_member/workspace_role/workspace_plan  membership/plan probing.
--   storage_workspace_id()  maps storage object names to workspace ids.
--   claim_job()/complete_job()  read queue payloads / mark jobs dead (DoS).
--   billing_* / ai_*        tamper with usage counters and AI credits.
--
-- Fix: revoke the PUBLIC grant on every client-irrelevant function. The
-- worker/admin-only ones then remain callable by the owner (postgres) and
-- service_role only; the RLS helpers keep an explicit `authenticated` grant.
-- Trigger functions are left untouched — they are not reachable over PostgREST,
-- and the non-SECURITY DEFINER ones (bump_updated_at, touch_updated_at) require
-- EXECUTE from the role performing the DML.

-- ------------------------------------------- worker / admin / edge only ---
revoke execute on function public.claim_job(text) from public;
revoke execute on function public.complete_job(bigint, boolean, text) from public;
revoke execute on function public.enqueue_due_posts() from public;
revoke execute on function public.enqueue_daily_snapshots() from public;
revoke execute on function public.enqueue_expiring_tokens() from public;
revoke execute on function public.notif_insert(uuid, uuid, text, text, text, text) from public;
revoke execute on function public.notif_admins(uuid) from public;
revoke execute on function public.billing_add_ai_generation(uuid) from public;
revoke execute on function public.ai_consume_credits(uuid, uuid, text, integer, text, text) from public;
revoke execute on function public.ai_refund_credits(text) from public;

grant execute on function public.claim_job(text) to service_role;
grant execute on function public.complete_job(bigint, boolean, text) to service_role;
grant execute on function public.enqueue_due_posts() to service_role;
grant execute on function public.enqueue_daily_snapshots() to service_role;
grant execute on function public.enqueue_expiring_tokens() to service_role;
grant execute on function public.notif_insert(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.notif_admins(uuid) to service_role;
grant execute on function public.billing_add_ai_generation(uuid) to service_role;
grant execute on function public.ai_consume_credits(uuid, uuid, text, integer, text, text) to service_role;
grant execute on function public.ai_refund_credits(text) to service_role;

-- --------------------------------------------- authenticated-only helpers ---
-- Used by RLS policies (`to authenticated`); anon never legitimately calls them.
revoke execute on function public.is_workspace_member(uuid) from public;
revoke execute on function public.workspace_role(uuid) from public;
revoke execute on function public.workspace_plan(uuid) from public;
revoke execute on function public.storage_workspace_id(text) from public;
revoke execute on function public.notif_provider_label(text) from public;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.workspace_plan(uuid) to authenticated;
grant execute on function public.storage_workspace_id(text) to authenticated;
grant execute on function public.notif_provider_label(text) to authenticated;
