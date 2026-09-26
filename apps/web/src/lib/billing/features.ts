/**
 * Feature comparison matrix for the pricing page. Values are generated from
 * the canonical PLANS config wherever a limit backs them, so the table can
 * never drift from what the server enforces. Purely qualitative capabilities
 * are listed explicitly per plan.
 */
import { PLANS, type PlanKey } from './plans';

export interface FeatureRow {
  label: string;
  /** string shown when present, false → ✕, true → ✓ */
  value: (plan: PlanKey) => string | boolean;
}

export interface FeatureCategory {
  title: string;
  rows: FeatureRow[];
}

function num(n: number | null, noun: string): string {
  if (n === null) return 'Unlimited';
  return `${n.toLocaleString('en-US')} ${noun}${n === 1 ? '' : 's'}`;
}

/** Every paid plan includes this; free includes a limited version. */
function paid(plan: PlanKey): boolean {
  return plan !== 'free';
}

export const FEATURE_MATRIX: FeatureCategory[] = [
  {
    title: 'Publishing',
    rows: [
      { label: 'Connected channels', value: (p) => num(PLANS[p].limits.channels, 'channel') },
      {
        label: 'Scheduled posts per channel',
        value: (p) => num(PLANS[p].limits.scheduledPostsPerChannel, 'post'),
      },
      { label: 'Calendar, queue & auto-publishing', value: () => true },
      { label: 'Content library', value: () => true },
    ],
  },
  {
    title: 'AI',
    rows: [
      { label: 'AI credits per month', value: (p) => num(PLANS[p].limits.aiCredits, 'credit') },
      { label: 'Captions, rewrites & hashtags', value: () => true },
      { label: 'Platform-specific adaptation', value: paid },
      { label: 'Threads & long-form generation', value: paid },
    ],
  },
  {
    title: 'Team & collaboration',
    rows: [
      { label: 'Team members', value: (p) => num(PLANS[p].limits.users, 'member') },
      { label: 'Workspaces / brands', value: (p) => num(PLANS[p].limits.workspaces, 'workspace') },
      { label: 'Approval workflow', value: (p) => p === 'team' || p === 'business' },
      { label: 'Roles & permissions', value: paid },
      { label: 'Client / agency workflows', value: (p) => p === 'business' },
    ],
  },
  {
    title: 'Analytics',
    rows: [
      { label: 'Basic analytics', value: () => true },
      { label: 'Reach, engagement & top posts', value: paid },
    ],
  },
  {
    title: 'Brand & security',
    rows: [
      {
        label: 'Sosial watermark',
        value: (p) => (PLANS[p].limits.watermarkRequired ? 'Required' : 'You control it'),
      },
      { label: 'Remove watermark', value: paid },
    ],
  },
];

export const FEATURE_PLAN_ORDER: PlanKey[] = ['free', 'solo', 'team', 'business'];
