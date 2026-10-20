/**
 * Feature comparison matrix for the pricing page. Values are generated from
 * the canonical PLANS config wherever a limit backs them, so the table can
 * never drift from what the server enforces. Labels are i18n keys resolved
 * at render; limit values are raw numbers (the view pluralizes).
 */
import { PLANS, type PlanKey } from './plans';

export interface FeatureValue {
  kind: 'ok' | 'no' | 'num' | 'text';
  /** For num: raw count. For text and num: i18n key (num = plural template). */
  n?: number;
  key?: string;
}

export interface FeatureRow {
  /** i18n key (pcF...) resolved at render. */
  label: string;
  value: (plan: PlanKey) => FeatureValue;
}

export interface FeatureCategory {
  /** i18n key (pcCat...) resolved at render. */
  title: string;
  rows: FeatureRow[];
}

/** Every paid plan includes this; free includes a limited version. */
function paid(plan: PlanKey): boolean {
  return plan !== 'free';
}

const ok = (): FeatureValue => ({ kind: 'ok' });
const no = (): FeatureValue => ({ kind: 'no' });
const num = (n: number | null, pluralKey: string): FeatureValue =>
  n === null ? { kind: 'text', key: 'pcUnlimited' } : { kind: 'num', n, key: pluralKey };
const text = (key: string) => (): FeatureValue => ({ kind: 'text', key });

export const FEATURE_MATRIX: FeatureCategory[] = [
  {
    title: 'pcCatPublishing',
    rows: [
      { label: 'pcFChannels', value: (p) => num(PLANS[p].limits.channels, 'pcNChannels') },
      { label: 'pcFSchedPosts', value: (p) => num(PLANS[p].limits.scheduledPostsPerChannel, 'pcNPosts') },
      { label: 'pcFCalendar', value: ok },
      { label: 'pcFLibrary', value: ok },
      { label: 'pcFXConnect', value: (p) => (paid(p) ? ok() : no()) },
    ],
  },
  {
    title: 'pcCatAi',
    rows: [
      { label: 'pcFCredits', value: (p) => num(PLANS[p].limits.aiCredits, 'pcNCredits') },
      { label: 'pcFCaptions', value: ok },
      { label: 'pcFAdapt', value: (p) => (paid(p) ? ok() : no()) },
      { label: 'pcFThreads', value: (p) => (paid(p) ? ok() : no()) },
    ],
  },
  {
    title: 'pcCatTeam',
    rows: [
      { label: 'pcFMembers', value: (p) => num(PLANS[p].limits.users, 'pcNMembers') },
      { label: 'pcFWorkspaces', value: (p) => num(PLANS[p].limits.workspaces, 'pcNWorkspaces') },
      { label: 'pcFApproval', value: (p) => (p === 'team' || p === 'business' ? ok() : no()) },
      { label: 'pcFRoles', value: (p) => (paid(p) ? ok() : no()) },
      { label: 'pcFClient', value: (p) => (p === 'business' ? ok() : no()) },
    ],
  },
  {
    title: 'pcCatAnalytics',
    rows: [
      { label: 'pcFBasic', value: ok },
      { label: 'pcFReach', value: (p) => (paid(p) ? ok() : no()) },
    ],
  },
  {
    title: 'pcCatBrand',
    rows: [
      {
        label: 'pcFWatermark',
        value: (p) => (PLANS[p].limits.watermarkRequired ? text('pcWmRequired')() : text('pcWmControl')()),
      },
      { label: 'pcFRemoveWm', value: (p) => (paid(p) ? ok() : no()) },
    ],
  },
];

export const FEATURE_PLAN_ORDER: PlanKey[] = ['free', 'solo', 'team', 'business'];
