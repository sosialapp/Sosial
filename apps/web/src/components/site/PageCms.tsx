import ChartIslands from '@/components/site/ChartIslands';
import { sitePageHtml } from '@/lib/sitePages';

/**
 * CMS content slot for marketing pages. Renders nothing — not even its
 * wrapper — until an admin saves content for the slug in /admin/pages, so
 * unwired pages are visually identical, and removing the row restores the
 * default design instantly.
 */
export default async function PageCms({
  slug,
  className = '',
}: {
  slug: string;
  className?: string;
}) {
  const html = await sitePageHtml(slug);
  if (!html) return null;
  return (
    <div className={className}>
      <div className="prose-sosial blog-rich" dangerouslySetInnerHTML={{ __html: html }} />
      <ChartIslands />
    </div>
  );
}
