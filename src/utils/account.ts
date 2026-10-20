import AsyncStorage from '@react-native-async-storage/async-storage';
import { uid } from '../constants';
import { clearAllAccounts } from './metaStore';

/** Local-only account (no backend): email + team live on-device. */
export interface Account {
  email: string;
  team: string;
  plan: 'free' | 'pro' | 'team';
  notifPosts: boolean;
  notifComments: boolean;
  notifWeekly: boolean;
  notifMarketing: boolean;
  locale: string;
}

const KEY = 'zap_account_v1';

export const ADMIN_LOCALES = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ar'] as const;

export const DEFAULT_ACCOUNT: Account = {
  email: '',
  team: 'My team',
  plan: 'free',
  notifPosts: true,
  notifComments: true,
  notifWeekly: false,
  notifMarketing: false,
  locale: 'en',
};

/** Native names, shown in the picker itself. */
export const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  ko: '한국어',
  zh: '中文 (简体)',
  ar: 'العربية',
};

export function accountId(): string {
  return `zap_${uid('acct').replace('acct_', '')}`;
}

export async function loadAccount(): Promise<Account> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_ACCOUNT };
    return { ...DEFAULT_ACCOUNT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_ACCOUNT };
  }
}

export async function saveAccount(patch: Partial<Account>): Promise<Account> {
  const cur = await loadAccount();
  const next = { ...cur, ...patch };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/** Delete-account: wipe every local store + token vault. */
export async function wipeAllData(): Promise<void> {
  const exact = [
    'quickpost_projects_v1',
    'quickpost_managed_posts_v1',
    'quickpost_text_posts_v1',
    'quickpost_bg_presets_v1',
    'quickpost_project_presets_v1',
    'zap_account_v1',
    'zap_ideas_v1',
    'zap_team_v1',
    'quickpost_open_post',
    'quickpost_compose',
  ];
  try {
    // Workspace-scoped mirrors are `base:<workspace_id>`, so match prefixes.
    const all = await AsyncStorage.getAllKeys();
    const keys = all.filter(
      (k) =>
        exact.includes(k) ||
        k.startsWith('quickpost_projects_v1:') ||
        k.startsWith('quickpost_managed_posts_v1:') ||
        k.startsWith('quickpost_text_posts_v1:'),
    );
    await AsyncStorage.multiRemove(keys);
  } catch {}
  await clearAllAccounts();
}
