-- P98 — messages uniqueness must be inferable by PostgREST.
--
-- messages_external_key was a partial unique index (WHERE external_id IS NOT
-- NULL). PostgREST cannot infer a partial index for ON CONFLICT, so the
-- upsert used by the inbox sweep failed with 42P10 and lost the whole batch
-- whenever two sweeps overlapped. A plain unique index has the same effect
-- (Postgres treats NULLs as distinct, so outbound rows without an external id
-- still coexist) and is inferable.

drop index if exists public.messages_external_key;

create unique index if not exists messages_external_key
  on public.messages (conversation_id, external_id);
