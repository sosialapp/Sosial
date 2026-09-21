import { BlockType } from '../../types';

/** AI output schema — deliberately narrower than ContentBlock: no ids, no colors,
 *  no pixel sizes. The model only decides words + block shape. */
export type GenBlock =
  | { type: 'free'; heading?: string; lines: string[] }
  | { type: 'bullets'; heading?: string; items: string[] }
  | { type: 'numbered'; heading?: string; items: string[] }
  | { type: 'table'; heading?: string; columns: string[]; rows: string[][] }
  | { type: 'bar' | 'vbar' | 'pie'; heading?: string; series: { label: string; value: number }[] }
  | { type: 'image'; heading?: string };

export interface GenPage {
  blocks: GenBlock[];
  /** optional hint for the empty image placeholder (never a URL we fetch) */
  imagePrompt?: string;
}

export type AiLanguage = 'auto' | 'English' | 'Bahasa Melayu' | '中文' | 'Tamil';

export const AI_LANGUAGES: { id: AiLanguage; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'English', label: 'English' },
  { id: 'Bahasa Melayu', label: 'Melayu' },
  { id: '中文', label: '中文' },
  { id: 'Tamil', label: 'Tamil' },
];

/** Output-language directive: Auto mirrors the user's prompt language. */
export function languageLine(language: AiLanguage): string {
  if (language === 'auto')
    return "Write in the SAME language as the user's idea below — mirror it exactly (Bahasa Melayu, 中文, Tamil, Manglish or mixed language included). Switch language only if the idea explicitly asks for another.";
  return `Write everything in ${language}.`;
}

export interface ContentBrief {
  /** free-form prompt — the user's idea, in their words */
  prompt: string;
  language: AiLanguage;
  pages: number;
  maxWordsPerPage: number;
  maxBlocksPerPage: number;
}

export interface GenResult {
  pages: GenPage[];
  provider: string;
  /** anything the normalizer had to clamp or drop — surfaced to the user */
  warnings: string[];
}

export const ALLOWED_TYPES: BlockType[] = ['free', 'bullets', 'numbered', 'table', 'bar', 'vbar', 'pie', 'image'];

export const DEFAULT_BRIEF: ContentBrief = {
  prompt: '',
  language: 'auto',
  pages: 3,
  maxWordsPerPage: 60,
  maxBlocksPerPage: 2,
};
