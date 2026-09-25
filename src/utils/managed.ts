import AsyncStorage from '@react-native-async-storage/async-storage';
import { uid } from '../constants';
import { pushPostToCloud, deleteCloudPost } from './cloudPosts';

export type PostStatus = 'draft' | 'queued' | 'approval' | 'sent';

export interface MediaAttachment {
  uri: string;
  kind: 'image' | 'video';
}

export type ChannelKey = 'facebook' | 'instagram' | 'threads' | 'tiktok' | 'x' | 'bluesky' | 'linkedin' | 'mastodon' | 'pinterest' | 'youtube';

/** Per-channel post format. TikTok is auto-derived from media (video vs photo). */
export type PlatformTypes = Partial<{
  facebook: 'post' | 'reel' | 'story';
  instagram: 'post' | 'reel' | 'story';
  threads: 'post' | 'ghost';
  tiktok: 'video' | 'photo';
  x: 'post';
  bluesky: 'post';
  linkedin: 'post';
  mastodon: 'post';
  pinterest: 'post';
  youtube: 'video' | 'short';
}>;

export const POST_TYPE_OPTIONS: Record<'facebook' | 'instagram' | 'threads' | 'x' | 'linkedin' | 'youtube' | 'bluesky' | 'mastodon' | 'pinterest' | 'tiktok', { id: string; label: string }[]> = {
  facebook: [
    { id: 'post', label: 'Post' },
    { id: 'reel', label: 'Reel' },
    { id: 'story', label: 'Story' },
  ],
  instagram: [
    { id: 'post', label: 'Post' },
    { id: 'reel', label: 'Reel' },
    { id: 'story', label: 'Story' },
  ],
  threads: [
    { id: 'post', label: 'Post' },
    { id: 'ghost', label: 'Ghost post' },
  ],
  x: [
    { id: 'post', label: 'Post' },
  ],
  linkedin: [
    { id: 'post', label: 'Post' },
  ],
  youtube: [
    { id: 'video', label: 'Video' },
    // Same upload — YouTube auto-classifies vertical ≤3min clips as Shorts.
    // No separate API exists, so this just records intent.
    { id: 'short', label: 'Short' },
  ],
  bluesky: [
    { id: 'post', label: 'Post' },
  ],
  mastodon: [
    { id: 'post', label: 'Post' },
  ],
  pinterest: [
    { id: 'post', label: 'Pin' },
  ],
  tiktok: [
    { id: 'video', label: 'Video' },
    { id: 'photo', label: 'Photo' },
  ],
};

/** Sensible default format for a channel given the attached media. */
export function defaultPlatformType(channel: ChannelKey, attachments: MediaAttachment[]): string {
  if (channel === 'tiktok') return attachments.some((a) => a.kind === 'video') ? 'video' : 'photo';
  if (channel === 'youtube') return 'video';
  if (channel === 'instagram') return attachments.some((a) => a.kind === 'video') ? 'reel' : 'post';
  return 'post';
}

/** A managed social post: title + photos/videos + description + channels + time + pipeline status. */
export interface ManagedPost {
  id: string;
  title: string;
  body: string;
  imageUri?: string;
  videoUri?: string;
  /** all attached media in order; legacy imageUri/videoUri mirror the first of each kind */
  attachments?: MediaAttachment[];
  platforms: string[];
  /** per-channel selected account ids (provider → account ids). Absent or
  *  empty = primary account for that provider. Legacy single-string picks
  *  read back as a one-item list. */
  accountIds?: Record<string, string[]>;
  /** per-channel post format (reel/story/repost/quote…) */
  platformTypes?: PlatformTypes;
  /** Threads community/topic pill (topic_tag param, max 50 chars) */
  threadsTopic?: string;
  /** TikTok audience picked upfront (privacy level); falls back to asking at publish */
  ttPrivacy?: string;
  /** YouTube listing (public/unlisted/private); defaults to public */
  ytPrivacy?: string;
  /** Threads repost/quote source post URL or numeric media ID */
  sourceUrl?: string;
  scheduledAt?: number;
  createdAt: number;
  /** last-write-wins clock for cross-device sync (ms). */
  updatedAt?: number;
  status?: PostStatus;
  sentAt?: number;
  /** per-channel remote ids returned at publish time (post/media/tweet/video id
   *  or at:// URI) — powers the per-post analytics in the Sent view.
   *  ALSO the duplicate guard: a channel recorded here is never reposted. */
  remoteIds?: Record<string, string>;
  /** lowercase channel → last failure note (cleared when that leg succeeds).
   *  Survives across attempts so the queue row can say WHY it's stuck. */
  channelErr?: Record<string, string>;
  /** lowercase channel → timestamp: auto-retry must not touch that leg before
   *  then. Set when a leg times out — its promise may still land. */
  retryAfter?: Record<string, number>;
  /** sweep attempts so far; parked (not retried) past MAX_AUTO_TRIES. */
  autoTries?: number;
  /** Thread chain segments, in order (manual or auto-split). When there's more
   *  than one, chain-capable channels (X/Threads/Bluesky/Mastodon) publish them
   *  as replies; every other channel gets `body` — the segments re-joined. */
  thread?: string[];
  /** Per-segment image (local uri or http), aligned to `thread` by index —
   *  null/undefined = no image on that segment. Only the phone publisher reads
   *  these for now; the cloud mirror ignores them (text-only chains there).
   *  @deprecated — replaced by threadMedia; still read as a fallback. */
  threadImages?: (string | null)[];
  /** Per-segment attachments (one or more images/videos), aligned to `thread`
   *  by index — null = none. Phone publisher attaches each to its reply. */
  threadMedia?: (ThreadSegmentMedia[] | null)[];
}

/** One chain segment's attachment: an image or video. */
export interface ThreadSegmentMedia {
  uri: string;
  kind: 'image' | 'video';
}

/** Most attachments a single chain segment may carry (X/Bluesky/Mastodon cap). */
export const THREAD_MEDIA_MAX = 4;

/** One chain segment paired with its attachments. */
export interface ThreadSegment {
  text: string;
  media: ThreadSegmentMedia[];
}

/** Fit a media array to a segment count (pad null / truncate). */
export function alignThreadMedia(media: (ThreadSegmentMedia[] | null)[] | undefined, n: number): (ThreadSegmentMedia[] | null)[] {
  const src = media ?? [];
  return Array.from({ length: Math.max(0, n) }, (_, i) => src[i] ?? null);
}

/** Chain segments for a post: the explicit thread if any, else the body. */
export function postSegments(p: ManagedPost): string[] {
  const segs = postThreadSegments(p).map((s) => s.text);
  if (segs.length) return segs;
  const b = (p.body ?? '').trim();
  return b ? [b] : [];
}

/** Raw per-segment attachments aligned to p.thread by index (no text filtering)
 *  — for loading the editor. Legacy threadImages read through as images. */
export function postThreadMedia(p: ManagedPost): (ThreadSegmentMedia[] | null)[] {
  const n = p.thread?.length ?? 0;
  const raw = (p.threadMedia ?? (p.threadImages ?? []).map((u) => (u ? { uri: u, kind: 'image' as const } : null))) as any[];
  // Pre-multi-attach records stored a bare object per slot — normalise to arrays.
  const norm = raw.map((m) => (m == null ? null : Array.isArray(m) ? m.filter(Boolean) : [m]));
  return alignThreadMedia(norm, n);
}

/** Chain segments paired with their per-segment attachment, in order. Empty-text
 *  segments drop WITH their attachment so indices stay aligned with
 *  postSegments — the same trim/drop rule the cloud mirror applies to text.
 *  Legacy threadImages records read through as image attachments. */
export function postThreadSegments(p: ManagedPost): ThreadSegment[] {
  const med = postThreadMedia(p);
  return (p.thread ?? [])
    .map((s, i) => ({ text: (s ?? '').trim(), media: med[i] ?? [] }))
    .filter((x) => x.text);
}

/** True when this post should publish as a multi-post chain. */
export function isThread(p: ManagedPost): boolean {
  return (p.thread ?? []).filter((s) => (s ?? '').trim()).length > 1;
}

/** Cooldown after a channel times out (its promise may still land) before auto-retry touches it again. */
export const LEG_COOLDOWN_MS = 30 * 60 * 1000;
/** Sweep gives up auto-retrying a post after this many attempts — parks loud for manual retry. */
export const MAX_AUTO_TRIES = 5;
/** Per-channel publish caps: video uploads + processing polls run long. */
export const VIDEO_CHANNEL_MS = 20 * 60 * 1000;
export const PHOTO_CHANNEL_MS = 150000;

/** Attachments with legacy fallback (posts saved before multi-attach existed). */
export function postAttachments(p: ManagedPost): MediaAttachment[] {
  if (p.attachments && p.attachments.length) return p.attachments;
  const out: MediaAttachment[] = [];
  if (p.imageUri) out.push({ uri: p.imageUri, kind: 'image' });
  if (p.videoUri) out.push({ uri: p.videoUri, kind: 'video' });
  return out;
}

/** Backfill status for posts saved before the pipeline existed. */
export function withStatus(p: ManagedPost): ManagedPost {
  if (p.status) return p;
  return { ...p, status: p.scheduledAt ? 'queued' : 'draft' };
}

/** Queue rule: scheduled posts need ≥5 min lead (pipeline lag + no overdue-on-arrival). */
export const MIN_QUEUE_LEAD_MS = 5 * 60 * 1000;

/**
 * Earliest queueable instant, floored to the minute — pickers are
 * minute-granular, so without flooring the exact +5min minute would almost
 * always be (seconds-)blocked. 7:51:37 → 7:56:00 allowed, 7:55 blocked.
 */
export function minQueueTime(now: number = Date.now()): number {
  return Math.floor((now + MIN_QUEUE_LEAD_MS) / 60000) * 60000;
}

/** True when the picked time is too close to queue. */
export function queueTooSoon(at: number, now: number = Date.now()): boolean {
  return at < minQueueTime(now);
}

/** "7:56" style label for the guard messages. */
export function minQueueLabel(now: number = Date.now()): string {
  try {
    return new Date(minQueueTime(now)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '5 minutes from now';
  }
}

/** A post with neither text nor media is unpublishable (drafts excepted — scratch is allowed). */
export function isEmptyPost(p: {
  title?: string;
  body?: string;
  attachments?: MediaAttachment[];
  imageUri?: string;
  videoUri?: string;
}): boolean {
  if ((p.title ?? '').trim() || (p.body ?? '').trim()) return false;
  return postAttachments(p as ManagedPost).length === 0;
}

const KEY = 'quickpost_managed_posts_v1';
const LEGACY_KEY = 'quickpost_text_posts_v1';

interface LegacyTextPost {
  id: string;
  title: string;
  body: string;
  platforms: string[];
  scheduledAt?: number;
  createdAt: number;
}

export async function loadManagedPosts(): Promise<ManagedPost[]> {
  try {
    let raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      // one-time migration from the old text-post store
      const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const legacy: LegacyTextPost[] = JSON.parse(legacyRaw);
        const migrated: ManagedPost[] = legacy.map((t) => ({
          id: t.id,
          title: t.title,
          body: t.body,
          platforms: t.platforms?.length ? t.platforms : ['any'],
          scheduledAt: t.scheduledAt,
          createdAt: t.createdAt,
        }));
        await AsyncStorage.setItem(KEY, JSON.stringify(migrated));
        await AsyncStorage.removeItem(LEGACY_KEY);
        raw = JSON.stringify(migrated);
      }
    }
    const list: ManagedPost[] = raw ? JSON.parse(raw) : [];
    return list.map(withStatus);
  } catch {
    return [];
  }
}

export async function saveManagedPost(p: ManagedPost): Promise<ManagedPost[]> {
  const { list, rec } = await writeManagedPost(p);
  // Cloud mirror is best-effort: local save already succeeded above.
  void pushPostToCloud(rec).catch((e: any) => console.log('[cloud] push failed:', e?.message ?? e));
  return list;
}

async function writeManagedPost(p: ManagedPost): Promise<{ list: ManagedPost[]; rec: ManagedPost }> {
  const list = await loadManagedPosts();
  const i = list.findIndex((x) => x.id === p.id);
  const rec = { ...p, id: p.id || uid('post'), updatedAt: Date.now() };
  if (i >= 0) list[i] = rec;
  else list.unshift(rec);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  return { list, rec };
}

/**
 * Local-only save — same AsyncStorage write, NO cloud mirror.
 * Progress writes (per-leg results, cooldowns, retry counters) must use this:
 * a full push re-uploads every media byte and upserts targets, which would
 * clobber worker verdicts and waste video bandwidth on every attempt.
 */
export async function saveManagedPostLocal(p: ManagedPost): Promise<ManagedPost[]> {
  const { list } = await writeManagedPost(p);
  return list;
}

export async function deleteManagedPost(id: string): Promise<ManagedPost[]> {
  const list = await loadManagedPosts();
  const next = list.filter((x) => x.id !== id);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  void deleteCloudPost(id).catch((e: any) => console.log('[cloud] delete failed:', e?.message ?? e));
  return next;
}
