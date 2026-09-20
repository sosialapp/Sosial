/**
 * OpenAI engine — preferred when an OpenAI key exists (built-in or on-device).
 *
 * Model is one const so it can be bumped in a single place.
 *  - plain generation + rewrites: Chat Completions with JSON mode
 *  - live research: Responses API with the hosted web_search tool
 * If the search-enabled call fails (model/tool mismatch, outage), the caller
 * retries without research — same honest-fallback contract as the Gemini path.
 */

const MODEL = 'gpt-4o-mini';
export const OPENAI_PROVIDER = 'GPT-4o mini';

const SYSTEM_JSON = 'You output strict JSON only. No markdown fences, no commentary.';

function openaiErr(status: number, j: any): string {
  const msg = String(j?.error?.message ?? j?.message ?? '');
  if (status === 401 || /incorrect api key|invalid.*api key|unauthorized/i.test(msg))
    return 'That OpenAI key was rejected — check it and try again.';
  if (/insufficient_quota|exceeded.*quota|billing|credit/i.test(msg))
    return 'OpenAI credit exhausted — top up billing and try again.';
  if (status === 429 || /rate limit/i.test(msg)) return 'Rate limit hit — wait a minute and retry.';
  if ((status >= 500 && status < 600) || /overload|server error/i.test(msg))
    return 'OpenAI is busy right now — try again in a moment.';
  return msg || 'OpenAI request failed.';
}

/** Pull the first top-level JSON object out of model text. */
function extractJson(text: string): any {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('The model returned unusable JSON — try again.');
  try {
    return JSON.parse(m[0]);
  } catch {
    throw new Error('The model returned unusable JSON — try again.');
  }
}

/** Chat Completions, JSON mode — deterministic shape, no tools. */
export async function openaiChatJson(key: string, system: string, user: string): Promise<any> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(openaiErr(r.status, j));
  const text = String(j.choices?.[0]?.message?.content ?? '');
  return extractJson(text);
}

/**
 * Responses API — same JSON contract, plus hosted web search when asked.
 * Returns the parsed object; sources/uncertainties come from the prompt schema.
 */
export async function openaiResponsesJson(key: string, input: string, search: boolean): Promise<any> {
  const body: any = {
    model: MODEL,
    input: `${SYSTEM_JSON}\n\n${input}`,
    max_output_tokens: 4096,
    text: { format: { type: 'json_object' } },
  };
  if (search) body.tools = [{ type: 'web_search' }];
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(openaiErr(r.status, j));
  let text = '';
  for (const item of j.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') text += part.text;
    }
  }
  return extractJson(text);
}

/** Writer-engine entry: built prompt in, parsed social response out. */
export async function openaiSocialRaw(prompt: string, search: boolean, key: string): Promise<any> {
  return openaiResponsesJson(key, prompt, search);
}

/** Carousel-engine entry: built prompt in, pages array out (rules.ts clamps it all). */
export async function openaiCarouselRaw(prompt: string, search: boolean, key: string): Promise<any[]> {
  const o = search
    ? await openaiResponsesJson(key, prompt, true)
    : await openaiChatJson(key, SYSTEM_JSON, prompt);
  if (o && Array.isArray(o.pages)) return o.pages;
  if (Array.isArray(o)) return o;
  throw new Error('The model returned unusable JSON — try again.');
}
