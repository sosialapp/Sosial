import { ContentBrief, GenResult } from './types';
import { normalizeResult } from './rules';
import { mockGenerate } from './mock';
import { buildCarouselPrompt } from './gemini';
import { serverGenerate, serverLabel, cloudSessionReady } from './server';

export interface GenOpts {
  /** Live web research for fresh facts — metered per call, so opt-in only */
  grounding?: boolean;
}

/**
 * AI runs on the server (metered against the plan's monthly credits) via the
 * generate-social Edge Function — the provider key never ships in the app.
 * Signed-out devices fall back to the offline draft engine so the flow still
 * works without a session. Either way the output goes through normalizeResult,
 * so card rules hold no matter who wrote the copy.
 */
export async function generate(brief: ContentBrief, opts: GenOpts = {}): Promise<GenResult> {
  const grounding = !!opts.grounding;
  const label = serverLabel(grounding);

  if (!(await cloudSessionReady())) {
    await new Promise((r) => setTimeout(r, 450));
    return normalizeResult(mockGenerate(brief) as any, brief, 'Draft engine (offline)');
  }

  try {
    const raw = await serverGenerate({
      prompt: buildCarouselPrompt(brief),
      grounding,
      action: 'longform',
    });
    return normalizeResult(raw as any, brief, label);
  } catch (e: any) {
    return { pages: [], provider: label, warnings: [e?.message ?? 'Generation failed.'] };
  }
}
