import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { readDocs, type DocsPage, type DocsSection } from './docs';

/** Admin read of every section and page, drafts included. Runs as the
 *  signed-in user, so RLS (is_app_admin) decides what comes back; the admin
 *  layout has already 404'd anyone else. */
export async function adminDocs(): Promise<{ sections: DocsSection[]; pages: DocsPage[] }> {
  return readDocs(await createClient(), false);
}
