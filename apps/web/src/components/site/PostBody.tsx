import Prose from '@/components/site/Prose';
import ChartIslands from '@/components/site/ChartIslands';
import type { Block } from '@/content/types';

/**
 * Public article body. New posts carry pre-serialized HTML (`body_html`) that
 * ships all text server-side for SEO; charts hydrate as islands. Posts never
 * re-saved since the old editor still use the legacy Block[] model and
 * render through Prose.
 */
export default function PostBody({
  bodyHtml,
  blocks,
}: {
  bodyHtml: string | null;
  blocks: Block[];
}) {
  if (bodyHtml && bodyHtml.trim()) {
    return (
      <>
        <div className="prose-sosial blog-rich" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        <ChartIslands />
      </>
    );
  }
  return <Prose blocks={blocks} />;
}
