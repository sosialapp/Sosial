import { redirect } from 'next/navigation';
import ImportNotion from '@/components/ImportNotion';
import { getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Content → Import (Notion). Connections, mapping, preview, import. */
export default async function ImportPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Content</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Import</h1>
      <p className="mt-1 text-sm text-muted">
        Bring content in from your tools, then schedule it like any other post.
      </p>
      <ImportNotion
        workspaceId={ctx.workspace.id}
        canImport={ctx.workspace.role === 'owner' || ctx.workspace.role === 'admin' || ctx.workspace.role === 'member'}
      />
    </div>
  );
}
