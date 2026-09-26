import { callEdgeFunction, isSupabaseConfigured, supabase } from '../supabase';

/**
 * The AI assistant is branded to users as one named model — the same label the
 * web app shows. The provider model behind it is internal.
 */
export const AI_SERVER_LABEL = 'GPT-5.6 Luna';

/** Credit costs (server-side) keyed by action, mirrored from the billing table. */
export type ServerAiAction =
  | 'rewrite' | 'shorten' | 'expand' | 'tone' | 'hashtags' | 'idea'
  | 'caption' | 'post' | 'adapt'
  | 'thread' | 'repurpose' | 'variations'
  | 'longform';

export interface ServerGenArgs {
  /** Finished prompt built on-device; the key that runs it never ships. */
  prompt: string;
  /** Live web research for time-sensitive topics. */
  grounding?: boolean;
  /** Picks the credit cost; defaults to a standard post (2 credits). */
  action?: ServerAiAction;
}

/**
 * Run one metered AI pass on the server. The provider key stays server-side
 * and every call draws from the workspace's monthly credit allowance, so Free
 * plans get their 20 credits instead of an unmetered bundled key.
 * Throws with the server's own message (out of credits, not signed in, …).
 */
export async function serverGenerate(args: ServerGenArgs): Promise<any> {
  const json = await callEdgeFunction('generate-social', {
    prompt: args.prompt,
    grounding: !!args.grounding,
    action: args.action ?? 'post',
  });
  if (!json || json.raw === undefined || json.raw === null) {
    throw new Error('The AI returned nothing — try again.');
  }
  return json.raw;
}

/** Provider label for results; "+ Search" when web research ran. */
export function serverLabel(grounding: boolean): string {
  return grounding ? `${AI_SERVER_LABEL} + Search` : AI_SERVER_LABEL;
}

/** True when the cloud backend is configured AND a user session is present. */
export async function cloudSessionReady(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data } = await supabase().auth.getSession();
    return !!data.session?.access_token;
  } catch {
    return false;
  }
}
