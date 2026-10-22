-- P100 — legacy Threads comment rows: mark our own replies as own.
--
-- The retired per-post scanner stored replies authored by the connected
-- account with is_own = false, which offers a "Reply" action on our own
-- comments. The unified adapter filters those out, so existing rows are
-- corrected here (matched on the channel's own display name/handle).

update public.comments cm
set is_own = true
from public.connected_channels c
where cm.channel_id = c.id
  and cm.platform = 'threads'
  and cm.is_own = false
  and lower(regexp_replace(coalesce(cm.author_name, ''), '^@', '')) =
      lower(regexp_replace(coalesce(nullif(c.display_name, ''), c.handle, ''), '^@', ''));
