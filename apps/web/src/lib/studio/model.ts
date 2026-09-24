/**
 * Canvas studio model — faithful port of the mobile design engine
 * (types.ts + constants + presets). Unit system: canvas units where the
 * design width is 340 (matches mobile CANVAS_W, so all sizing math ports).
 */

export type PostSizeId = 'square' | 'portrait' | 'story' | 'landscape' | 'a4';

export interface PostSize {
  id: PostSizeId;
  label: string;
  hint: string;
  width: number;
  height: number;
  ratio: number;
}

export const POST_SIZES: PostSize[] = [
  { id: 'square', label: '1:1 Square', hint: 'IG / FB post · 1080×1080', width: 1080, height: 1080, ratio: 1 },
  { id: 'portrait', label: '4:5 Portrait', hint: 'IG portrait · 1080×1350', width: 1080, height: 1350, ratio: 1.25 },
  { id: 'story', label: '9:16 Story', hint: 'Story / Reel / TikTok · 1080×1920', width: 1080, height: 1920, ratio: 16 / 9 },
  { id: 'landscape', label: '16:9 Wide', hint: 'YouTube / X · 1920×1080', width: 1920, height: 1080, ratio: 9 / 16 },
  { id: 'a4', label: 'A4 Flyer', hint: 'Print / carousel · 1240×1754', width: 1240, height: 1754, ratio: 1.414 },
];

export const PALETTE = [
  '#111111', '#FFFFFF', '#F5F1E8', '#FFE45E', '#FF5C5C',
  '#4D7CFE', '#22C55E', '#A855F7', '#EC4899', '#0EA5E9',
  '#F97316', '#14B8A6', '#EAB308', '#1F2937',
  '#7C2D12', '#92400E', '#1F6C9F', '#346538', '#9F2F2D',
  '#6B7280', '#F9E2CF', '#E1F3FE', '#EDF3EC', '#FDEBEC',
];

export const BG_PRESETS = [
  { label: 'Minimal light', color: '#F5F1E8', patternColor: '#111111' },
  { label: 'Midnight', color: '#111111', patternColor: '#FFE45E' },
  { label: 'Paper dots', color: '#FFFFFF', patternColor: '#CBD5E1' },
  { label: 'Ocean grid', color: '#0EA5E9', patternColor: '#FFFFFF' },
];

export type BgType =
  | 'solid' | 'grid' | 'dots' | 'stripes' | 'zigzag' | 'waves'
  | 'hearts' | 'stars' | 'crosses' | 'doodle' | 'image';

export interface BackgroundStyle {
  type: BgType;
  color: string;
  patternColor: string;
  patternSize: number;
  patternOpacity: number;
  imageUri?: string;
  imageOpacity?: number;
  mixEnabled: boolean;
  mixType?: BgType;
  mixColor?: string;
  mixOpacity?: number;
}

export type TitlePosition = 'top' | 'bottom' | 'none';

export interface PostTitle {
  text: string;
  position: TitlePosition;
  color: string;
  size: number;
  align: 'left' | 'center' | 'right';
  font: FontId;
  bold: boolean;
  italic: boolean;
  subtitle?: string;
  subtitleSize?: number;
  subtitleColor?: string;
}

export type FontId =
  | 'inter' | 'jakarta' | 'space-grotesk' | 'playfair' | 'crimson'
  | 'poppins' | 'mono' | 'anton' | 'system';

/** Web font stacks (loaded in layout; system fallbacks always last). */
export const FONT_STACKS: Record<FontId, string> = {
  inter: 'Inter, system-ui, sans-serif',
  jakarta: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
  'space-grotesk': '"Space Grotesk", Inter, system-ui, sans-serif',
  playfair: '"Playfair Display", Georgia, serif',
  crimson: '"Crimson Pro", Georgia, serif',
  poppins: 'Poppins, Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  anton: 'Anton, "Arial Narrow", sans-serif',
  system: 'system-ui, sans-serif',
};

export const FONT_OPTIONS: { value: FontId; label: string }[] = [
  { value: 'jakarta', label: 'Jakarta' },
  { value: 'inter', label: 'Inter' },
  { value: 'space-grotesk', label: 'Space Grotesk' },
  { value: 'playfair', label: 'Playfair' },
  { value: 'crimson', label: 'Crimson' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'mono', label: 'Mono' },
  { value: 'anton', label: 'Anton' },
  { value: 'system', label: 'System' },
];

export interface PfpStyle {
  uri?: string;
  hidden?: boolean;
  pfpY: 'top' | 'bottom';
  size: number;
  shape: 'circle' | 'rounded';
  socialPos: 'below' | 'right' | 'left';
  badgeBg: boolean;
  badgeRows: 1 | 2;
  handleColor: string;
  handleSize: number;
  iconSize: number;
  iconOutline: boolean;
  socialGap: number;
  align: 'left' | 'center' | 'right';
  borderW: number;
  username?: string;
}

export type SocialPlatform =
  | 'instagram' | 'tiktok' | 'threads' | 'x' | 'facebook' | 'youtube'
  | 'whatsapp' | 'linkedin' | 'bluesky' | 'mastodon' | 'pinterest';

export const ALL_SOCIALS: SocialPlatform[] = [
  'instagram', 'tiktok', 'threads', 'facebook', 'youtube',
  'x', 'bluesky', 'mastodon', 'pinterest',
];

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  handle: string;
  visible: boolean;
  font: FontId;
  bold: boolean;
  italic: boolean;
}

export type BlockType = 'bullets' | 'numbered' | 'table' | 'bar' | 'pie' | 'vbar' | 'free' | 'image';

export interface ContentBlock {
  id: string;
  type: BlockType;
  heading?: string;
  items: string[];
  table?: string[][];
  chart?: { label: string; value: number; color?: string }[];
  imageUri?: string;
  imageH?: number;
  imageAspect?: 'square' | 'wide' | 'custom';
  imageFocus?: number;
  imageCrop?: { zoom: number; x: number; y: number };
  textColor?: string;
}

export type CardStyle =
  | 'minimal' | 'facebook' | 'x' | 'instagram' | 'threads'
  | 'bluesky';

export const CARD_STYLES: { id: CardStyle; label: string }[] = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'threads', label: 'Threads' },
  { id: 'x', label: 'X' },
  { id: 'bluesky', label: 'Bluesky' },
];

export interface PostPage {
  id: string;
  background: BackgroundStyle;
  title: PostTitle;
  pfp: PfpStyle;
  socials: SocialLink[];
  blocks: ContentBlock[];
  font: FontId;
  cardStyle: CardStyle;
  fullCard?: boolean;
  cardColor?: string;
  cardH?: number | null;
  cardAuto?: boolean;
  cardY?: 'top' | 'middle' | 'bottom';
  stickToCard?: boolean;
  contentScale?: number;
  verified?: boolean;
  showWatermark?: boolean;
  caption?: string;
}

export interface StudioProject {
  id: string;
  name: string;
  sizeId: PostSizeId;
  font: FontId;
  createdAt: number;
  pages: PostPage[];
}

/** Chart accent cycle (matches mobile DATA). */
export const DATA = ['#4D7CFE', '#22C55E', '#A855F7', '#EC4899', '#0EA5E9', '#F97316', '#14B8A6', '#EAB308'];

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Detect the first number anywhere in the line — "$45000", "Jan $40", "40%" all work. */
export function parseChartLine(line: string): { label: string; value: number } {
  const m = line.match(/-?[\d,]*\.?\d+/);
  if (!m || m[0].replace(/[.,-]/g, '') === '') return { label: line.trim() || 'Item', value: 0 };
  const value = parseFloat(m[0].replace(/,/g, '')) || 0;
  const label = line.replace(m[0], '').replace(/^[,\s]+|[,\s]+$/g, '').trim() || 'Item';
  return { label, value };
}

export function blankBackground(): BackgroundStyle {
  return {
    type: 'dots',
    color: '#F5F1E8',
    patternColor: '#111111',
    patternSize: 22,
    patternOpacity: 0.12,
    mixEnabled: false,
    mixType: 'grid',
    mixColor: '#4D7CFE',
    mixOpacity: 0.12,
    imageOpacity: 0.35,
  };
}

export function blankTitle(): PostTitle {
  return {
    text: 'My Sosial title',
    position: 'top',
    color: '#111111',
    size: 28,
    align: 'center',
    font: 'jakarta',
    bold: true,
    italic: false,
    subtitle: '',
    subtitleSize: 15,
    subtitleColor: '#57534E',
  };
}

export function blankPfp(): PfpStyle {
  return {
    pfpY: 'bottom',
    size: 40,
    shape: 'circle',
    socialPos: 'right',
    badgeBg: true,
    badgeRows: 1,
    handleColor: '#FFFFFF',
    handleSize: 7.5,
    iconSize: 24,
    iconOutline: false,
    socialGap: 6,
    align: 'center',
    borderW: 0,
    username: '',
  };
}

export function defaultSocials(): SocialLink[] {
  return [
    { id: uid('s'), platform: 'instagram', handle: '@yourhandle', visible: true, font: 'jakarta', bold: true, italic: false },
    { id: uid('s'), platform: 'tiktok', handle: '@yourhandle', visible: false, font: 'jakarta', bold: true, italic: false },
    { id: uid('s'), platform: 'x', handle: '@yourhandle', visible: false, font: 'jakarta', bold: true, italic: false },
  ];
}

export function defaultBlocks(): ContentBlock[] {
  return [
    { id: uid('b'), type: 'bullets', heading: '3 quick wins', items: ['One clear idea per slide', 'Big text, lots of whitespace', 'End with your handle'], textColor: '#111111' },
  ];
}

export function blankPage(): PostPage {
  return {
    id: uid('page'),
    background: blankBackground(),
    title: blankTitle(),
    pfp: blankPfp(),
    socials: defaultSocials(),
    blocks: defaultBlocks(),
    font: 'jakarta',
    cardStyle: 'minimal',
    cardColor: '#FFFFFFF2',
    cardH: null,
    verified: true,
    showWatermark: true,
    caption: '',
  };
}

export function blankProject(name = 'Untitled design'): StudioProject {
  return {
    id: uid('design'),
    name,
    sizeId: 'portrait',
    font: 'inter',
    createdAt: Date.now(),
    pages: [blankPage()],
  };
}

export function newBlock(type: BlockType): ContentBlock {
  if (type === 'table')
    return { id: uid('b'), type, heading: 'Comparison', items: [], table: [['Feature', 'A', 'B'], ['Price', '$9', '$19'], ['Rating', '4.8', '4.5']] };
  if (type === 'bar' || type === 'vbar')
    return { id: uid('b'), type, heading: 'Stats', items: [], chart: [{ label: 'Jan', value: 40 }, { label: 'Feb', value: 65 }, { label: 'Mar', value: 50 }] };
  if (type === 'pie')
    return { id: uid('b'), type, heading: 'Split', items: [], chart: [{ label: 'A', value: 50 }, { label: 'B', value: 30 }, { label: 'C', value: 20 }] };
  if (type === 'numbered')
    return { id: uid('b'), type, heading: 'Steps', items: ['First step', 'Second step', 'Third step'] };
  if (type === 'free') return { id: uid('b'), type, heading: '', items: ['Write anything here…'] };
  if (type === 'image') return { id: uid('b'), type, heading: '', items: [], imageH: 140 };
  return { id: uid('b'), type: 'bullets', heading: 'Points', items: ['Point one', 'Point two'] };
}
