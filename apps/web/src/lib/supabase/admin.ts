import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for server-side billing writes (webhook sync,
 * checkout bookkeeping). Bypasses RLS — never import from client components.
 * Requires SUPABASE_SERVICE_ROLE_KEY in the web environment.
 */
let admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Service role not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (!admin) admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}
