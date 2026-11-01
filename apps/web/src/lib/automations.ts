import 'server-only';
import { getWorkspaceContext } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';

/** Signed-in caller, or a ready-made error response. */
export type AutomationCaller =
  | { ctx: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>> }
  | { error: Response };

export function isAutomationAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Auto-replies are a paid feature and only owners/admins may change them.
 * The worker re-checks the plan, so an old browser tab cannot bypass this.
 */
export async function requireAutomationAdmin(): Promise<AutomationCaller> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { error: Response.json({ error: 'Sign in first.' }, { status: 401 }) };
  if (!isAutomationAdmin(ctx.workspace.role)) {
    return {
      error: Response.json(
        { error: 'Only workspace owners and admins can edit auto-replies.' },
        { status: 403 },
      ),
    };
  }
  const ent = await getEntitlement(ctx.workspace.id);
  if (ent.plan === 'free') {
    return {
      error: Response.json(
        { error: 'Auto-replies are available on paid plans.', upgrade: true },
        { status: 402 },
      ),
    };
  }
  return { ctx };
}

/** Read-only access (members can see the rules and the activity log). */
export async function requireAutomationMember(): Promise<AutomationCaller> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { error: Response.json({ error: 'Sign in first.' }, { status: 401 }) };
  return { ctx };
}
