import PushComposer from '@/components/PushComposer';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Owner broadcast: compose once, the worker fans out to every device. */
export default async function AdminNotificationsPage() {
  const sb = await createClient();
  const { count } = await sb.from('push_tokens').select('id', { count: 'exact', head: true });

  return (
    <div>
      <p className="eyebrow">Owner console</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        Notifications
      </h1>
      <p className="mt-1 text-sm text-muted">
        Broadcast to every registered device · {(count ?? 0) === 0 ? 'no devices yet' : `${count} device${count === 1 ? '' : 's'}`}
      </p>
      <div className="mt-4 max-w-2xl">
        <PushComposer audience={count ?? 0} />
      </div>
    </div>
  );
}
