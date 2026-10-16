import { redirect } from 'next/navigation';
import AccountSettings from '@/components/AccountSettings';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';
import { PLANS } from '@/lib/billing/plans';

export const metadata = { title: 'Profile' };


export const dynamic = 'force-dynamic';

/** Account settings, mirrors the mobile Account screen on the web backend. */
export default async function ProfilePage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const { data: prof } = await sb
    .from('profiles')
    .select('notif_posts, notif_comments, notif_weekly')
    .eq('id', ctx.user.id)
    .maybeSingle();
  const p = (prof ?? {}) as { notif_posts?: boolean; notif_comments?: boolean; notif_weekly?: boolean };
  const ent = await getEntitlement(ctx.workspace.id);
  return (
    <AccountSettings
      email={ctx.user.email ?? ''}
      workspaceId={ctx.workspace.id}
      workspaceName={ctx.workspace.name}
      planLabel={PLANS[ent.plan].label}
      role={ctx.workspace.role}
      canRename={ctx.workspace.role === 'owner' || ctx.workspace.role === 'admin'}
      userId={ctx.user.id}
      initialNotif={{
        posts: p.notif_posts ?? true,
        comments: p.notif_comments ?? true,
        weekly: p.notif_weekly ?? false,
      }}
    />
  );
}
