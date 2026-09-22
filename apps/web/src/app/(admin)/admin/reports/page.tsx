import ReportInbox from '@/components/ReportInbox';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Reports inbox: every user report, newest first (RLS: admins only). */
export default async function AdminReportsPage() {
  const sb = await createClient();
  const { data } = await sb
    .from('reports')
    .select('id, email, kind, subject, body, status, admin_note, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div>
      <p className="eyebrow">Owner console</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Reports</h1>
      <p className="mt-1 text-sm text-muted">
        Bugs, ideas and billing help from users · {(data ?? []).length} shown
      </p>
      <div className="mt-4">
        <ReportInbox initial={data ?? []} />
      </div>
    </div>
  );
}
