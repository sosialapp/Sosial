-- P39 · Retire the Discord inbox
--
-- The inbox (message sync + replies) is removed. Discord posting/publishing
-- is untouched. The channel_messages table stays (empty) for future
-- providers; the cron schedule and enqueue function go away.

select cron.unschedule('sosial-enqueue-inbox');

drop function if exists public.enqueue_due_inbox();

delete from public.channel_messages;
