'use client';

import { useEffect, useMemo, useState } from 'react';
import { invokeStock } from '@/lib/cloudSources';
import { TT_PRIVACY_LABELS } from '@/lib/providers';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';

/**
 * TikTok's Content Sharing Guidelines require the publish surface to show, at
 * render time, who is posting, which privacy levels TikTok allows, whether the
 * creator's account still allows comments/duets/stitches, and the commercial
 * content disclosure. Nothing here is defaulted: privacy starts empty and the
 * three interaction boxes start unchecked, exactly as the guidelines ask.
 *
 * Creator info is fetched live through the `tiktok-creator-info` edge function
 * (the browser cannot read the Vault token). Failures degrade to the levels
 * stored at connect time and say so, instead of blocking the composer.
 */

export interface TikTokCreator {
  channelId: string;
  nickname: string;
  avatarUrl: string;
  privacyOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxDurationSec: number;
  /** False when TikTok says the creator cannot post right now. */
  canPost: boolean;
  error?: string;
}

export interface TikTokChoice {
  /** '' until the user picks one; TikTok has no default audience for us. */
  privacy: string;
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  /** Off by default: "this content promotes a brand". */
  commercial: boolean;
  brandOrganic: boolean;
  brandContent: boolean;
}

export const EMPTY_TIKTOK_CHOICE: TikTokChoice = {
  privacy: '',
  allowComment: false,
  allowDuet: false,
  allowStitch: false,
  commercial: false,
  brandOrganic: false,
  brandContent: false,
};

const MUSIC_URL = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en';
const BC_URL = 'https://www.tiktok.com/legal/page/global/bc-policy/en';

interface ChannelLite {
  id: string;
  metadata?: Record<string, unknown> | null;
}

export default function TikTokOptions({
  workspaceId,
  channels,
  value,
  onChange,
  isPhoto,
  videoUrl,
  onBlock,
}: {
  workspaceId: string;
  channels: ChannelLite[];
  value: TikTokChoice;
  onChange: (next: TikTokChoice) => void;
  /** Photo carousel: TikTok only offers comment control for photos. */
  isPhoto: boolean;
  /** The attached video, measured against the account's max duration. */
  videoUrl?: string;
  /** Why TikTok would refuse this post right now (null = nothing blocks). */
  onBlock?: (reason: string | null) => void;
}) {
  const t = useT(appMessages);
  const [creators, setCreators] = useState<TikTokCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const ids = channels.map((c) => c.id).join(',');

  useEffect(() => {
    const list = ids ? ids.split(',') : [];
    if (!list.length) {
      setCreators([]);
      return;
    }
    let alive = true;
    setLoading(true);
    setNote(null);
    void (async () => {
      try {
        const j = await invokeStock('tiktok-creator-info', {
          workspace_id: workspaceId,
          channel_ids: list,
        });
        const rows = Array.isArray(j?.creators) ? (j.creators as any[]) : [];
        const mapped: TikTokCreator[] = rows.map((r) => ({
          channelId: String(r.channel_id ?? ''),
          nickname: String(r.nickname ?? ''),
          avatarUrl: String(r.avatar_url ?? ''),
          privacyOptions: Array.isArray(r.privacy_level_options) ? r.privacy_level_options.map(String) : [],
          commentDisabled: r.comment_disabled === true,
          duetDisabled: r.duet_disabled === true,
          stitchDisabled: r.stitch_disabled === true,
          maxDurationSec: Number(r.max_video_post_duration_sec ?? 0) || 0,
          canPost: r.can_post !== false,
          error: typeof r.error === 'string' ? r.error : undefined,
        }));
        if (!alive) return;
        setCreators(mapped);
        if (mapped.some((c) => c.error)) {
          setNote(mapped.find((c) => c.error)?.error ?? null);
        }
      } catch (e) {
        if (!alive) return;
        setCreators([]);
        setNote(e instanceof Error ? e.message : t('ttInfoErr'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, workspaceId]);

  /** Levels every selected account accepts; falls back to what connect saved. */
  const options = useMemo(() => {
    const live = creators.filter((c) => c.privacyOptions.length > 0).map((c) => c.privacyOptions);
    if (live.length) {
      const shared = live.reduce((a, b) => a.filter((o) => b.includes(o)));
      if (shared.length) return shared;
      return live[0];
    }
    const stored = channels
      .map((c) => (c.metadata as { ttPrivacyOptions?: unknown } | null)?.ttPrivacyOptions)
      .filter((o): o is string[] => Array.isArray(o) && o.length > 0);
    return stored.length ? stored.reduce((a, b) => a.filter((o) => b.includes(o))) : [];
  }, [creators, channels]);

  /** A level the account no longer accepts must not survive a channel change. */
  useEffect(() => {
    if (!value.privacy || !options.length) return;
    if (!options.includes(value.privacy)) onChange({ ...value, privacy: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join(','), value.privacy]);

  const commentOff = creators.some((c) => c.commentDisabled);
  const duetOff = creators.some((c) => c.duetDisabled);
  const stitchOff = creators.some((c) => c.stitchDisabled);
  const maxMin = useMemo(() => {
    const secs = creators.map((c) => c.maxDurationSec).filter((s) => s > 0);
    return secs.length ? Math.min(...secs) / 60 : 0;
  }, [creators]);

  /** Length of the attached video, read from its metadata (0 = unknown). */
  const [videoSec, setVideoSec] = useState(0);
  useEffect(() => {
    setVideoSec(0);
    if (!videoUrl || isPhoto) return;
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => setVideoSec(Number.isFinite(v.duration) ? v.duration : 0);
    v.src = videoUrl;
    return () => {
      v.onloadedmetadata = null;
      v.removeAttribute('src');
    };
  }, [videoUrl, isPhoto]);

  const cannotPost = creators.find((c) => !c.canPost);
  const tooLong = maxMin > 0 && videoSec > maxMin * 60 + 0.5;
  const block = cannotPost
    ? cannotPost.error || t('ttCannotPost')
    : tooLong
      ? t('ttTooLong')
          .replace('{n}', String(Math.ceil(videoSec / 60)))
          .replace('{m}', String(Math.round(maxMin)))
      : null;
  useEffect(() => {
    onBlock?.(block);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block]);
  useEffect(() => () => onBlock?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<TikTokChoice>) => onChange({ ...value, ...patch });

  const box = 'flex cursor-pointer items-center gap-2 text-xs font-semibold text-soft';
  const boxOff = 'flex cursor-not-allowed items-center gap-2 text-xs font-semibold text-faint';

  return (
    <div className="mt-3 grid gap-3" data-tour="composer-tiktok">
      {/* 1a - who is posting */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-24 shrink-0 text-[11px] font-bold text-muted">{t('ttPostAs')}</span>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {loading ? (
            <span className="text-[11px] font-semibold text-faint">{t('ttInfoLoading')}</span>
          ) : null}
          {creators.map((c) => (
            <span key={c.channelId} className="flex items-center gap-2">
              {c.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.avatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[9px] font-extrabold text-paper">
                  TT
                </span>
              )}
              <span className="max-w-[16rem] truncate text-xs font-bold text-ink">
                {c.nickname || t('ttNoName')}
              </span>
            </span>
          ))}
          {!loading && !creators.length ? (
            <span className="text-[11px] font-semibold text-faint">{t('ttNoName')}</span>
          ) : null}
        </div>
      </div>

      {/* 2b - privacy, no default */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="tt-privacy" className="w-24 shrink-0 text-[11px] font-bold text-muted">
          {t('cpTtAudience')}
        </label>
        <select
          id="tt-privacy"
          value={value.privacy}
          onChange={(e) => set({ privacy: e.target.value })}
          className="field max-w-[16rem]"
          required
          aria-required="true"
        >
          <option value="">{t('ttPickAudience')}</option>
          {options.map((o) => (
            <option
              key={o}
              value={o}
              disabled={o === 'SELF_ONLY' && value.brandContent}
              title={o === 'SELF_ONLY' && value.brandContent ? t('ttPrivateNoBrand') : undefined}
            >
              {TT_PRIVACY_LABELS[o] ?? o}
            </option>
          ))}
        </select>
        {value.brandContent ? (
          <span className="text-[11px] font-semibold text-faint">{t('ttPrivateNoBrand')}</span>
        ) : null}
      </div>

      {/* 2c - interactions, unchecked by default, greyed when the account says no */}
      <fieldset className="grid gap-1.5">
        <legend className="w-24 text-[11px] font-bold text-muted">{t('ttInteractions')}</legend>
        <label className={commentOff ? boxOff : box}>
          <input
            type="checkbox"
            checked={value.allowComment && !commentOff}
            disabled={commentOff}
            onChange={(e) => set({ allowComment: e.target.checked })}
            className="h-4 w-4 accent-[#1C1A14]"
          />
          {t('ttAllowComment')}
        </label>
        {isPhoto ? (
          <p className="text-[10px] font-semibold text-faint">{t('ttPhotoComment')}</p>
        ) : (
          <>
            <label className={duetOff ? boxOff : box}>
              <input
                type="checkbox"
                checked={value.allowDuet && !duetOff}
                disabled={duetOff}
                onChange={(e) => set({ allowDuet: e.target.checked })}
                className="h-4 w-4 accent-[#1C1A14]"
              />
              {t('ttAllowDuet')}
            </label>
            <label className={stitchOff ? boxOff : box}>
              <input
                type="checkbox"
                checked={value.allowStitch && !stitchOff}
                disabled={stitchOff}
                onChange={(e) => set({ allowStitch: e.target.checked })}
                className="h-4 w-4 accent-[#1C1A14]"
              />
              {t('ttAllowStitch')}
            </label>
          </>
        )}
        {maxMin > 0 && !isPhoto ? (
          <p className="mt-0.5 text-[10px] font-semibold text-faint">
            {t('ttMaxDuration').replace('{n}', String(Math.round(maxMin)))}
          </p>
        ) : null}
      </fieldset>

      {/* 3 - commercial content disclosure, off by default */}
      <div className="grid gap-1.5">
        <label className={box}>
          <input
            type="checkbox"
            checked={value.commercial}
            onChange={(e) =>
              set({
                commercial: e.target.checked,
                ...(e.target.checked ? {} : { brandOrganic: false, brandContent: false }),
              })
            }
            className="h-4 w-4 accent-[#1C1A14]"
          />
          {t('ttCommercial')}
        </label>
        {value.commercial ? (
          <div className="ml-6 grid gap-1.5">
            <p
              className={
                value.brandOrganic || value.brandContent
                  ? 'text-[10px] font-semibold text-faint'
                  : 'text-[10px] font-bold text-amber-700 dark:text-amber-300'
              }
            >
              {t('ttCommercialNote')}
            </p>
            <label className={box}>
              <input
                type="checkbox"
                checked={value.brandOrganic}
                onChange={(e) => set({ brandOrganic: e.target.checked })}
                className="h-4 w-4 accent-[#1C1A14]"
              />
              {t('ttYourBrand')}
            </label>
            {/* Branded content can't be private: while "Only me" is the
                audience the box is disabled and says why. */}
            <label
              className={value.privacy === 'SELF_ONLY' ? boxOff : box}
              title={value.privacy === 'SELF_ONLY' ? t('ttBrandNeedsPublic') : undefined}
            >
              <input
                type="checkbox"
                checked={value.brandContent}
                disabled={value.privacy === 'SELF_ONLY' && !value.brandContent}
                onChange={(e) => set({ brandContent: e.target.checked })}
                className="h-4 w-4 accent-[#1C1A14]"
              />
              {t('ttBrandedContent')}
            </label>
            {value.privacy === 'SELF_ONLY' && !value.brandContent ? (
              <p className="text-[10px] font-semibold text-faint">{t('ttBrandNeedsPublic')}</p>
            ) : null}
            {value.brandContent || value.brandOrganic ? (
              <p className="text-[11px] font-bold text-ink">
                {value.brandContent ? t('ttLabelPaid') : t('ttLabelPromo')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 4 - declaration */}
      <p className="text-[10px] font-semibold leading-relaxed text-faint">
        {value.brandContent ? (
          <>
            {t('ttDeclare')}{' '}
            <a href={BC_URL} target="_blank" rel="noreferrer" className="font-bold text-ink underline">
              {t('ttBCPolicy')}
            </a>{' '}
            {t('ttAnd')}{' '}
            <a href={MUSIC_URL} target="_blank" rel="noreferrer" className="font-bold text-ink underline">
              {t('ttMusicUsage')}
            </a>
            .
          </>
        ) : (
          <>
            {t('ttDeclare')}{' '}
            <a href={MUSIC_URL} target="_blank" rel="noreferrer" className="font-bold text-ink underline">
              {t('ttMusicUsage')}
            </a>
            .
          </>
        )}
      </p>

      {/* 5 - processing notice */}
      <p className="text-[10px] font-semibold leading-relaxed text-faint">{t('ttProcessing')}</p>

      {block ? (
        <p className="text-[11px] font-bold text-[#9F2F2D] dark:text-[#f2a8a8]">{block}</p>
      ) : null}

      {note && note !== block ? (
        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">{note}</p>
      ) : null}
    </div>
  );
}