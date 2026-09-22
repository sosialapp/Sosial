import type { SupabaseClient } from '@supabase/supabase-js';

export interface AiSegment {
  caption: string;
  hashtags: string[];
}

export interface AiGenerateArgs {
  topic: string;
  /** Provider keys of the picked channels — the function caps copy at the strictest. */
  providers: string[];
  /** 1 = single caption, more = threaded chain parts. */
  count: number;
  tone: string;
}

/** Call the generate-captions edge function (auth attachs the user JWT). */
export async function generateCaptions(
  sb: SupabaseClient,
  args: AiGenerateArgs,
): Promise<AiSegment[]> {
  const { data, error } = await sb.functions.invoke('generate-captions', { body: args });
  if (error) throw new Error(error.message);
  const segs = (data as { segments?: AiSegment[]; error?: string } | null)?.segments;
  if (!segs?.length) {
    throw new Error(
      (data as { error?: string } | null)?.error ?? 'The AI returned nothing. Try again.',
    );
  }
  return segs;
}

/** Append hashtags to a caption the way the mobile composer does. */
export function withHashtags(caption: string, hashtags: string[]): string {
  const tags = hashtags.map((h) => `#${h}`).join(' ');
  if (!tags) return caption;
  return caption ? `${caption}\n\n${tags}` : tags;
}
