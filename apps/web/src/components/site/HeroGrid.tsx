import { GridPulse } from '@/components/ui/grid-pulse';
import { BRAND_PATHS, type BrandProvider } from '@/components/BrandIcon';

/** Channel marks that ride inside the lit cells. */
const HERO_LOGOS: BrandProvider[] = [
  'x',
  'instagram',
  'tiktok',
  'facebook',
  'threads',
  'youtube',
  'linkedin',
  'bluesky',
  'mastodon',
  'pinterest',
  'telegram',
  'discord',
  'vk',
];

const LOGO_PATHS = HERO_LOGOS.map((p) => BRAND_PATHS[p]);

/**
 * The landing hero's background: an interactive grid whose cells light up in
 * colour under the pointer, some carrying a channel logo. One definition for
 * the landing page and every page hero, so they always match. Place it first
 * inside a `relative overflow-clip` box, put the content in a `relative z-[2]`
 * layer, and mark its text with `data-grid-avoid` so the light stays off it.
 */
export default function HeroGrid() {
  return <GridPulse cell={26} logos={LOGO_PATHS} logoChance={0.22} ambient={3} />;
}
