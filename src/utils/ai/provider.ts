import { ContentBrief, GenResult } from './types';
import { normalizeResult } from './rules';
import { mockGenerate } from './mock';
import { geminiRaw, buildCarouselPrompt } from './gemini';
import { openaiCarouselRaw, OPENAI_PROVIDER } from './openai';
import { getAiKey, getOpenAiKey } from './key';

export interface GenOpts {
  /** Live web research for fresh facts — metered per call, so opt-in only */
  grounding?: boolean;
}

/**
 * OpenAI when its key exists, Gemini next, offline draft engine last.
 * Either way the output goes through normalizeResult, so card rules hold
 * no matter who wrote the copy.
 *
 * Later: a server-side provider can plug in here behind the same interface
 * (and hold the key itself) without touching the UI or the rules.
 */
export async function generate(brief: ContentBrief, opts: GenOpts = {}): Promise<GenResult> {
  const oKey = await getOpenAiKey();
  if (oKey) {
    try {
      const pages = await openaiCarouselRaw(buildCarouselPrompt(brief), !!opts.grounding, oKey);
      return normalizeResult(pages as any, brief, opts.grounding ? `${OPENAI_PROVIDER} + Search` : OPENAI_PROVIDER);
    } catch (e: any) {
      return { pages: [], provider: OPENAI_PROVIDER, warnings: [e?.message ?? 'Generation failed.'] };
    }
  }
  const key = await getAiKey();
  if (key) {
    try {
      const raw = await geminiRaw(brief, key, !!opts.grounding);
      return normalizeResult(raw as any, brief, opts.grounding ? 'Gemini 3.8 Flash + Search' : 'Gemini 3.8 Flash');
    } catch (e: any) {
      return { pages: [], provider: 'Gemini 3.8 Flash', warnings: [e?.message ?? 'Generation failed.'] };
    }
  }
  await new Promise((r) => setTimeout(r, 450));
  return normalizeResult(mockGenerate(brief) as any, brief, 'Draft engine (offline)');
}
