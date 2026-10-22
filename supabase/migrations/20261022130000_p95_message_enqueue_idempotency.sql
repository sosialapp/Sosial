-- p95: job_queue.idempotency_key is NOT NULL, but the message enqueue helpers
-- never set it, so every DM send and comment reply died at insert time
-- ("null value in column idempotency_key"). Generate a key per call: retries of
-- the same click are deduped by the worker, two real messages are two jobs.

create or replace function public.enqueue_send_message(p_channel uuid, p_conversation uuid, p_text text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_text is null or length(btrim(p_text)) = 0 or length(btrim(p_text)) > 2000 then
    raise exception 'invalid_message';
  end if;
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  values (
    'send_message',
    jsonb_build_object(
      'channel_id', p_channel,
      'conversation_id', p_conversation,
      'text', btrim(p_text)
    ),
    now(),
    'send_message:' || gen_random_uuid()::text
  );
end;
$$;

create or replace function public.enqueue_reply_comment(p_channel uuid, p_comment uuid, p_text text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_text is null or length(btrim(p_text)) = 0 or length(btrim(p_text)) > 2000 then
    raise exception 'invalid_message';
  end if;
  insert into public.job_queue (kind, payload, run_at, idempotency_key)
  values (
    'reply_comment',
    jsonb_build_object(
      'channel_id', p_channel,
      'comment_id', p_comment,
      'text', btrim(p_text)
    ),
    now(),
    'reply_comment:' || gen_random_uuid()::text
  );
end;
$$;
