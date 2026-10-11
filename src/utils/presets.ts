import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackgroundStyle, PostPage, QuickPost, SocialLink, SocialPlatform } from '../types';
import { uid } from '../constants';
import { pushLibraryItem, tombstoneLibraryItem, pullLibraryRows } from './librarySync';

const KEY = 'quickpost_bg_presets_v1';

export interface BgPreset {
  id: string;
  name: string;
  bg: BackgroundStyle;
}

export async function loadCustomBgPresets(): Promise<BgPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveCustomBgPreset(preset: BgPreset): Promise<BgPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: BgPreset[] = raw ? JSON.parse(raw) : [];
    list.unshift(preset);
    const next = list.slice(0, 30);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export async function deleteCustomBgPreset(id: string): Promise<BgPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: BgPreset[] = raw ? JSON.parse(raw) : [];
    const next = list.filter((x) => x.id !== id);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

/* ---------- Full-project presets (size + backdrop + title + photo/socials + content) ---------- */

const PROJECT_KEY = 'quickpost_project_presets_v1';

export interface ProjectPreset {
  id: string;
  name: string;
  post: QuickPost;
  createdAt: number;
  /** starter templates shipped with the app (deletable, never re-seeded) */
  builtIn?: boolean;
  /** last-write-wins clock for cross-device sync (ms). */
  updatedAt?: number;
}

/** A template saved on the web — different design format, shown as a text
 *  card ("Use text" drops its words into a new draft). */
export interface ForeignTemplate {
  id: string;
  name: string;
  excerpt: string;
  origin: string;
  updatedAt: number;
}

const FOREIGN_KEY = 'quickpost_foreign_templates_v1';

export async function loadForeignTemplates(): Promise<ForeignTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(FOREIGN_KEY);
    const list: ForeignTemplate[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function loadProjectPresets(): Promise<ProjectPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(PROJECT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveProjectPreset(post: QuickPost): Promise<ProjectPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(PROJECT_KEY);
    const list: ProjectPreset[] = raw ? JSON.parse(raw) : [];
    const preset: ProjectPreset = {
      id: uid('tpl'),
      name: post.name,
      post: JSON.parse(JSON.stringify(post)),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.unshift(preset);
    const next = list.slice(0, 30);
    await AsyncStorage.setItem(PROJECT_KEY, JSON.stringify(next));
    void pushLibraryItem('template', preset.id, preset.name, preset as unknown as Record<string, unknown>);
    return next;
  } catch {
    return [];
  }
}

export async function renameProjectPreset(id: string, name: string): Promise<ProjectPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(PROJECT_KEY);
    const list: ProjectPreset[] = raw ? JSON.parse(raw) : [];
    const p = list.find((x) => x.id === id);
    if (p) {
      p.name = name;
      p.updatedAt = Date.now();
      void pushLibraryItem('template', p.id, p.name, p as unknown as Record<string, unknown>);
    }
    await AsyncStorage.setItem(PROJECT_KEY, JSON.stringify(list));
    return list;
  } catch {
    return [];
  }
}

export async function deleteProjectPreset(id: string): Promise<ProjectPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(PROJECT_KEY);
    const list: ProjectPreset[] = raw ? JSON.parse(raw) : [];
    const next = list.filter((x) => x.id !== id);
    await AsyncStorage.setItem(PROJECT_KEY, JSON.stringify(next));
    void tombstoneLibraryItem('template', id);
    return next;
  } catch {
    return [];
  }
}

export async function deleteForeignTemplate(id: string): Promise<ForeignTemplate[]> {
  const list = await loadForeignTemplates();
  const next = list.filter((x) => x.id !== id);
  try {
    await AsyncStorage.setItem(FOREIGN_KEY, JSON.stringify(next));
  } catch {}
  void tombstoneLibraryItem('template', id);
  return next;
}

function isNativeTemplateData(d: Record<string, unknown>): boolean {
  return !!d && typeof d.post === 'object' && d.post !== null && !d.builtIn;
}

/**
 * Two-way template sync. Native rows (mobile QuickPost designs) merge by
 * last-write-wins; web rows (different design format) are kept as text
 * cards, never rendered as designs. Built-ins never leave the device.
 */
export async function syncTemplates(): Promise<{ native: ProjectPreset[]; foreign: ForeignTemplate[] }> {
  const rows = await pullLibraryRows().catch(() => null);
  const native = await loadProjectPresets();
  const foreign = await loadForeignTemplates();
  if (!rows) return { native, foreign };

  const byId = new Map(native.map((x) => [x.id, x]));
  const foreignById = new Map(foreign.map((x) => [x.id, x]));
  const cloudById = new Map<string, (typeof rows)[number]>();
  let nativeDirty = false;
  let foreignDirty = false;

  for (const r of rows) {
    if (r.kind !== 'template') continue;
    cloudById.set(r.client_id, r);
    const d = (r.data ?? {}) as Record<string, unknown>;
    if (d.builtIn) continue;
    const cloudTs = Date.parse(r.updated_at) || 0;
    if (r.deleted_at) {
      const delTs = Date.parse(r.deleted_at);
      const local = byId.get(r.client_id);
      if (local && (local.updatedAt ?? local.createdAt ?? 0) < delTs) {
        byId.delete(r.client_id);
        nativeDirty = true;
      }
      if (foreignById.has(r.client_id)) {
        foreignById.delete(r.client_id);
        foreignDirty = true;
      }
      continue;
    }
    if (isNativeTemplateData(d)) {
      const local = byId.get(r.client_id);
      const localTs = local ? (local.updatedAt ?? local.createdAt ?? 0) : -1;
      if (!local || cloudTs > localTs) {
        byId.set(r.client_id, {
          id: r.client_id,
          name: String(d.name ?? r.title ?? 'Template'),
          post: d.post as QuickPost,
          createdAt: Number(d.createdAt) || Date.now(),
          updatedAt: cloudTs || Date.now(),
        });
        nativeDirty = true;
      }
    } else if (d._origin === 'web') {
      const body = typeof d.body === 'string' ? d.body : '';
      const title = typeof d.title === 'string' && d.title ? d.title : undefined;
      const excerpt = title && body ? `${title}\n${body}` : title ?? body;
      const cur = foreignById.get(r.client_id);
      if (!cur || cloudTs > cur.updatedAt) {
        foreignById.set(r.client_id, {
          id: r.client_id,
          name: String(d.name ?? r.title ?? 'Template'),
          excerpt: excerpt.slice(0, 280),
          origin: 'web',
          updatedAt: cloudTs || Date.now(),
        });
        foreignDirty = true;
      }
    }
  }
  for (const local of byId.values()) {
    if (local.builtIn) continue;
    const cloud = cloudById.get(local.id);
    const localTs = local.updatedAt ?? local.createdAt ?? 0;
    if (!cloud || (cloud.deleted_at == null && (Date.parse(cloud.updated_at) || 0) < localTs)) {
      void pushLibraryItem('template', local.id, local.name, local as unknown as Record<string, unknown>);
    }
  }

  const nextNative = [...byId.values()];
  const nextForeign = [...foreignById.values()];
  try {
    if (nativeDirty) await AsyncStorage.setItem(PROJECT_KEY, JSON.stringify(nextNative));
    if (foreignDirty) await AsyncStorage.setItem(FOREIGN_KEY, JSON.stringify(nextForeign));
  } catch {}
  return { native: nextNative, foreign: nextForeign };
}

/* ---------------- Starter templates (prebuilt, offline-safe) ---------------- */

const SEED_KEY = 'quickpost_seeded_starter_templates_v2';
/** v1 seeds replaced by the web-parity starters below. */
const V1_IDS = ['starter-quote-v1', 'starter-sale-v1', 'starter-news-v1'];

/** Default pfp config (matches the editor's blank page). */
function seedPfp(): PostPage['pfp'] {
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

function seedSocial(platform: SocialPlatform, handle: string): SocialLink {
  return { id: uid('s'), platform, handle, visible: true, font: 'jakarta', bold: true, italic: false };
}

/**
 * Starter designs — mirrored from the web app's starterProjects()
 * (apps/web/src/components/CreateHub.tsx). Keep the three in sync:
 * same sizes, backgrounds, typography, blocks, socials and captions.
 */
function starterLaunch(): PostPage {
  return {
    id: uid('page'),
    background: { type: 'dots', color: '#111111', patternColor: '#FFE45E', patternSize: 26, patternOpacity: 0.5, mixEnabled: false },
    title: {
      text: 'It’s live.', position: 'top', color: '#FFFFFF', size: 40,
      align: 'left', font: 'jakarta', bold: true, italic: false,
      subtitle: 'Everything you asked for, in one place.', subtitleSize: 15, subtitleColor: '#F5F1E8',
    },
    pfp: seedPfp(),
    socials: [seedSocial('instagram', '@yourhandle')],
    blocks: [
      { id: uid('b'), type: 'bullets', heading: 'What’s new', items: ['Faster than ever', 'Works everywhere', 'Free to try'], textColor: '#111111' },
    ],
    font: 'jakarta',
    cardStyle: 'minimal',
    cardColor: '#FFFFFFF2',
    showWatermark: true,
    caption: 'Big news, it’s live! #launch #newdrop',
  };
}

function starterQuote(): PostPage {
  return {
    id: uid('page'),
    background: { type: 'solid', color: '#F5F1E8', patternColor: '#111111', patternSize: 22, patternOpacity: 0.12, mixEnabled: false },
    title: {
      text: '“Show up every day.”', position: 'top', color: '#111111', size: 36,
      align: 'center', font: 'playfair', bold: true, italic: false,
      subtitle: 'Consistency beats intensity.', subtitleSize: 15, subtitleColor: '#57534E',
    },
    pfp: { ...seedPfp(), hidden: true },
    socials: [],
    blocks: [],
    font: 'jakarta',
    cardStyle: 'minimal',
    cardColor: '#FFFFFFF2',
    showWatermark: true,
    caption: '',
  };
}

function starterPromo(): PostPage {
  return {
    id: uid('page'),
    background: { type: 'stripes', color: '#7C2D12', patternColor: '#F97316', patternSize: 30, patternOpacity: 0.5, mixEnabled: false },
    title: {
      text: '20% off ends Sunday', position: 'top', color: '#FFFFFF', size: 38,
      align: 'left', font: 'jakarta', bold: true, italic: false,
      subtitle: '', subtitleSize: 15,
    },
    pfp: seedPfp(),
    socials: [seedSocial('tiktok', '@yourhandle')],
    blocks: [
      { id: uid('b'), type: 'table', heading: 'Plans', items: [], table: [['Plan', 'Monthly', 'Yearly'], ['Solo', '$12', '$120'], ['Team', '$29', '$290']], textColor: '#111111' },
    ],
    font: 'jakarta',
    cardStyle: 'minimal',
    cardColor: '#FFFFFFF2',
    showWatermark: true,
    caption: 'One weekend only. #sale #promo',
  };
}

function starterPost(name: string, sizeId: QuickPost['sizeId'], page: PostPage): QuickPost {
  return { id: uid('post'), name, sizeId, font: 'jakarta', createdAt: Date.now(), pages: [page] };
}

/**
 * First-run seed: three ready-made designs (web parity) so the Templates
 * page is never bare. v2 replaces the old pastel seeds; deleting a starter
 * never brings it back.
 */
export async function seedStarterTemplates(): Promise<ProjectPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(PROJECT_KEY);
    let list: ProjectPreset[] = raw ? JSON.parse(raw) : [];
    const done = await AsyncStorage.getItem(SEED_KEY);
    if (done) return list;
    const has = (id: string) => list.some((x) => x.id === id);
    // v1 seeds are superseded — swap them out for the web-parity set.
    list = list.filter((x) => !(x.builtIn && V1_IDS.includes(x.id)));
    const seeds: ProjectPreset[] = [];
    const now = Date.now();
    if (!has('starter-launch-v2')) {
      seeds.push({
        id: 'starter-launch-v2', name: 'Launch card', builtIn: true, createdAt: now,
        post: starterPost('Launch card', 'portrait', starterLaunch()),
      });
    }
    if (!has('starter-quote-v2')) {
      seeds.push({
        id: 'starter-quote-v2', name: 'Quote card', builtIn: true, createdAt: now,
        post: starterPost('Quote card', 'square', starterQuote()),
      });
    }
    if (!has('starter-promo-v2')) {
      seeds.push({
        id: 'starter-promo-v2', name: 'Promo card', builtIn: true, createdAt: now,
        post: starterPost('Promo card', 'story', starterPromo()),
      });
    }
    const next = [...list, ...seeds];
    await AsyncStorage.setItem(PROJECT_KEY, JSON.stringify(next));
    await AsyncStorage.setItem(SEED_KEY, '1');
    return next;
  } catch {
    return [];
  }
}

/** Instantiate a preset as a fresh editable project. */
export async function instantiatePreset(id: string): Promise<QuickPost | null> {
  try {
    const raw = await AsyncStorage.getItem(PROJECT_KEY);
    const list: ProjectPreset[] = raw ? JSON.parse(raw) : [];
    const found = list.find((x) => x.id === id);
    if (!found) return null;
    const copy: QuickPost = {
      ...JSON.parse(JSON.stringify(found.post)),
      id: uid('proj'),
      createdAt: Date.now(),
    };
    return copy;
  } catch {
    return null;
  }
}
