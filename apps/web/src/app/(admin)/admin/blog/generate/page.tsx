import AdminBlogGenerate from '@/components/AdminBlogGenerate';

export const dynamic = 'force-dynamic';

/** Owner console: SEO blog autopilot. AI drafts full articles into the drafts
 *  list (OpenAI copy + Openverse images), a human reviews and publishes. */
export default function AdminBlogGeneratePage() {
  return <AdminBlogGenerate />;
}
