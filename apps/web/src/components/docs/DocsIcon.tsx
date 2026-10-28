import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarClock,
  CheckCheck,
  Code,
  CreditCard,
  FileInput,
  FileText,
  Globe,
  HelpCircle,
  History,
  Image as ImageIcon,
  Key,
  LayoutTemplate,
  MessagesSquare,
  PenLine,
  Plug,
  Rocket,
  Settings,
  Shield,
  Sparkles,
  Users,
  Webhook,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { BRAND_NAMES, BrandIcon, type BrandProvider } from '@/components/BrandIcon';

/** Icon names an admin can pick for a docs page or section. Stored as text
 *  in docs_pages.icon / docs_sections.icon; 'brand:<provider>' shows a logo. */
export const DOCS_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  rocket: { label: 'Rocket', icon: Rocket },
  'book-open': { label: 'Book', icon: BookOpen },
  plug: { label: 'Plug', icon: Plug },
  'calendar-clock': { label: 'Calendar', icon: CalendarClock },
  history: { label: 'History', icon: History },
  globe: { label: 'Globe', icon: Globe },
  code: { label: 'Code', icon: Code },
  bot: { label: 'Bot', icon: Bot },
  key: { label: 'Key', icon: Key },
  webhook: { label: 'Webhook', icon: Webhook },
  zap: { label: 'Bolt', icon: Zap },
  'pen-line': { label: 'Pen', icon: PenLine },
  sparkles: { label: 'Sparkles', icon: Sparkles },
  'check-check': { label: 'Approve', icon: CheckCheck },
  messages: { label: 'Messages', icon: MessagesSquare },
  chart: { label: 'Chart', icon: BarChart3 },
  template: { label: 'Template', icon: LayoutTemplate },
  image: { label: 'Image', icon: ImageIcon },
  import: { label: 'Import', icon: FileInput },
  users: { label: 'Team', icon: Users },
  card: { label: 'Billing', icon: CreditCard },
  shield: { label: 'Shield', icon: Shield },
  settings: { label: 'Settings', icon: Settings },
  help: { label: 'Help', icon: HelpCircle },
  file: { label: 'Page', icon: FileText },
};

export const BRAND_ICON_KEYS = Object.keys(BRAND_NAMES).filter((k) => k !== 'google') as BrandProvider[];

/** Every choice for the admin picker, value → label. */
export const DOCS_ICON_CHOICES: { value: string; label: string }[] = [
  ...Object.entries(DOCS_ICONS).map(([value, v]) => ({ value, label: v.label })),
  ...BRAND_ICON_KEYS.map((k) => ({ value: `brand:${k}`, label: `${BRAND_NAMES[k]} logo` })),
];

/** A docs icon by name. Unknown or empty names render `fallback` (or nothing). */
export default function DocsIcon({
  name,
  className = 'h-4 w-4',
  fallback = false,
}: {
  name: string;
  className?: string;
  /** Show a plain page icon when the name is empty or unknown. */
  fallback?: boolean;
}) {
  if (name.startsWith('brand:')) {
    const key = name.slice(6) as BrandProvider;
    if (key in BRAND_NAMES) {
      // Mono glyph in currentColor, like the nav's other icons; dark brand
      // discs would vanish on the black docs theme.
      return <BrandIcon provider={key} mono className={className} />;
    }
  }
  const Icon = DOCS_ICONS[name]?.icon ?? (fallback ? FileText : null);
  return Icon ? <Icon className={className} aria-hidden="true" /> : null;
}
