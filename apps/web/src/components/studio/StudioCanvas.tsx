/**
 * StudioCanvas — DOM port of mobile PostCanvas. Inline styles throughout so
 * the export serializer captures the tree exactly. k = width / 340.
 */
import { BrandIcon } from '@/components/BrandIcon';
import { providerMeta } from '@/lib/providers';
import {
  FONT_STACKS,
  type CardStyle,
  type FontId,
  type PostPage,
} from '@/lib/studio/model';
import { PatternBackground } from './patterns';
import { BlockView, ChromeIcon, VERIFIED_SEAL } from './blocks';

function ff(font: FontId | undefined, bold = false, italic = false): React.CSSProperties {
  return {
    fontFamily: FONT_STACKS[font ?? 'inter'],
    fontWeight: bold ? 700 : 400,
    fontStyle: italic ? 'italic' : 'normal',
  };
}

function hexLum(hex: string): number {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isDarkHex(hex: string): boolean {
  return hexLum(hex || '#ffffff') < 0.45;
}

function contrastRatio(a: string, b: string): number {
  const l1 = hexLum(a);
  const l2 = hexLum(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* --------------------------------- chrome ---------------------------------- */

interface ChromeCtx {
  page: PostPage;
  font: FontId;
  ink: string;
  gray: string;
  faint: string;
  hairline: string;
  cardBg: string;
  name: string;
  firstHandle: string;
  showCheck: boolean;
  watermark?: boolean;
}

function chromeCtx(page: PostPage): ChromeCtx {
  const cardBg = page.cardColor ?? '#FFFFFFF2';
  const dark = isDarkHex(cardBg);
  const firstHandle = page.socials.find((s) => s.visible && s.handle)?.handle || '@yourhandle';
  const uni = page.pfp.username?.trim();
  return {
    page,
    font: page.font ?? 'inter',
    ink: dark ? '#FFFFFF' : '#111111',
    gray: dark ? '#CFC9BD' : '#65676B',
    faint: dark ? '#A8A29E' : '#B0B3B8',
    hairline: dark ? '#FFFFFF24' : '#11111114',
    cardBg,
    name: uni || firstHandle.replace(/^@/, ''),
    firstHandle,
    showCheck: page.verified ?? true,
    // The watermark switch lives on the page — every chrome style honours it.
    watermark: page.showWatermark ?? true,
  };
}

function Check({ c, size, k }: { c: ChromeCtx; size: number; k: number }) {
  if (!c.showCheck) return null;
  const sealed = c.page.cardStyle === 'facebook' || c.page.cardStyle === 'instagram' || c.page.cardStyle === 'threads';
  if (!sealed) {
    return (
      <svg width={size * k} height={size * k} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#1D9BF0" />
        <path d="m8 12.5 2.5 2.5L16 9.5" stroke="#fff" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={size * k} height={size * k} viewBox="0 0 24 24" aria-hidden="true">
      <path d={VERIFIED_SEAL} fill="#1D9BF0" />
      <path d="m8 12.5 2.5 2.5L16 9.5" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActionRow({ c, k, items }: { c: ChromeCtx; k: number; items: { icon: string; label: string }[] }) {
  return (
    <div style={{ borderTopWidth: Math.max(1, k), borderTopStyle: 'solid', borderTopColor: c.hairline, display: 'flex', padding: `${7 * k}px 0` }}>
      {items.map((a) => (
        <span key={a.label} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 * k }}>
          <ChromeIcon name={a.icon} size={12 * k} color={c.gray} />
          <span style={{ ...ff(c.font), fontSize: 9 * k, color: c.gray }}>{a.label}</span>
        </span>
      ))}
    </div>
  );
}

function Chrome({ c, k, children, fit, maxH, watermark: wmProp }: { c: ChromeCtx; k: number; children: React.ReactNode; fit?: boolean; maxH?: number; watermark?: boolean }) {
  const { page } = c;
  const style: CardStyle = page.cardStyle ?? 'minimal';
  const watermark = wmProp ?? c.watermark ?? true;
  const bodyPad = 13 * k;
  const bodyStyle: React.CSSProperties = fit
    ? { padding: bodyPad, gap: 10 * k, flexShrink: 1, maxHeight: maxH, overflow: 'hidden' }
    : { padding: bodyPad, gap: 10 * k, flex: 1, minHeight: 0 };
  const shell = (radius: number, extra?: React.CSSProperties): React.CSSProperties => ({
    ...(fit ? { flexShrink: 1, maxHeight: maxH, overflow: 'hidden' } : { flex: 1, minHeight: 0 }),
    backgroundColor: c.cardBg, borderRadius: radius * k,
    borderWidth: Math.max(1, k), borderStyle: 'solid',
    borderColor: style === 'minimal' ? '#11111112' : c.hairline,
    overflow: 'hidden', display: 'flex', flexDirection: 'column', ...extra,
  });
  const headerRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7 * k };

  if (style === 'facebook') {
    return (
      <div style={shell(8)}>
        <div style={{ ...headerRow, padding: `${10 * k}px ${12 * k}px 0` }}>
          <AvatarMark page={page} size={24} k={k} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 * k }}>
              <span style={{ ...ff(c.font, true), fontSize: 9.5 * k, color: c.ink }}>{c.name} </span>
              <Check c={c} size={9} k={k} />
              {c.watermark ? <Watermark font={c.font} size={8} color={c.gray} k={k} /> : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 * k }}>
              <span style={{ ...ff(c.font), fontSize: 7.5 * k, color: c.gray }}>2h · Public</span>
              <ChromeIcon name="globe" size={8 * k} color={c.gray} />
            </div>
          </div>
          <ChromeIcon name="dots" size={12 * k} color={c.gray} />
        </div>
        <div style={bodyStyle}>{children}</div>
        <div style={{ display: 'flex', alignItems: 'center', padding: `0 ${12 * k}px ${7 * k}px` }}>
          <span style={{ width: 15 * k, height: 15 * k, borderRadius: 7.5 * k, backgroundColor: '#1877F2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChromeIcon name="like" size={9 * k} color="#fff" />
          </span>
          <span style={{ ...ff(c.font), fontSize: 8.5 * k, color: c.gray, marginLeft: 5 * k }}>1.2K</span>
          <span style={{ flex: 1 }} />
          <span style={{ ...ff(c.font), fontSize: 8.5 * k, color: c.gray }}>48 comments · 12 shares</span>
        </div>
        <ActionRow c={c} k={k} items={[{ icon: 'fb-like', label: 'Like' }, { icon: 'fb-comment', label: 'Comment' }, { icon: 'fb-share', label: 'Share' }]} />
      </div>
    );
  }

  if (style === 'x') {
    return (
      <div style={shell(14)}>
        <div style={{ ...headerRow, padding: `${11 * k}px ${13 * k}px 0` }}>
          <AvatarMark page={page} size={22} k={k} />
          <span style={{ ...ff(c.font, true), fontSize: 9 * k, color: c.ink }}>{c.name} </span>
          <Check c={c} size={9} k={k} />
          <span style={{ ...ff(c.font), fontSize: 8.5 * k, color: c.gray }}>{c.firstHandle} · 2h</span>
          {c.watermark ? <Watermark font={c.font} size={8} color={c.gray} k={k} /> : null}
          <span style={{ flex: 1 }} />
          <ChromeIcon name="dots" size={11 * k} color={c.gray} />
        </div>
        <div style={bodyStyle}>{children}</div>
        <div style={{ display: 'flex', alignItems: 'center', padding: `0 ${14 * k}px ${10 * k}px`, gap: 4 * k }}>
          {[
            { icon: 'x-comment', count: '12', color: c.gray },
            { icon: 'x-retweet', count: '48', color: '#22C55E' },
            { icon: 'ig-heart', count: '312', color: '#EC4899' },
            { icon: 'x-views', count: '2.1K', color: c.gray },
          ].map((a, i) => (
            <span key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3 * k }}>
              <ChromeIcon name={a.icon} size={13 * k} color={a.color} />
              <span style={{ ...ff(c.font), fontSize: 8 * k, color: c.gray }}>{a.count}</span>
            </span>
          ))}
          <ChromeIcon name="x-bookmark" size={13 * k} color={c.gray} />
          <span style={{ width: 6 * k }} />
          <ChromeIcon name="x-share" size={13 * k} color={c.gray} />
        </div>
      </div>
    );
  }

  if (style === 'instagram') {
    return (
      <div style={shell(6)}>
        <div style={{ ...headerRow, padding: `${10 * k}px ${12 * k}px 0` }}>
          <AvatarMark page={page} size={20} k={k} />
          <span style={{ ...ff(c.font, true), fontSize: 9 * k, color: c.ink }}>{c.name} </span>
          <Check c={c} size={9} k={k} />
          {c.watermark ? <Watermark font={c.font} size={8} color={c.gray} k={k} /> : null}
          <span style={{ flex: 1 }} />
          <span style={{ width: 16 * k, height: 16 * k, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'visible' }}>
            <BrandIcon provider="instagram" badge={false} className="h-[68%] w-[68%]" />
          </span>
          <ChromeIcon name="dots" size={12 * k} color={c.ink} />
        </div>
        <div style={bodyStyle}>{children}</div>
        <div style={{ padding: `0 ${12 * k}px ${11 * k}px`, display: 'flex', flexDirection: 'column', gap: 6 * k }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 * k }}>
            <ChromeIcon name="ig-heart" size={14 * k} color={c.ink} />
            <ChromeIcon name="ig-comment" size={14 * k} color={c.ink} />
            <ChromeIcon name="ig-repost" size={14 * k} color={c.ink} />
            <ChromeIcon name="ig-plane" size={14 * k} color={c.ink} />
            <span style={{ flex: 1 }} />
            <ChromeIcon name="ig-bookmark" size={14 * k} color={c.ink} />
          </div>
          <p style={{ ...ff(c.font), fontSize: 8.5 * k, color: c.ink, margin: 0 }}>
            <span style={{ ...ff(c.font, true) }}>Liked by you</span> and 1,234 others
          </p>
          <p style={{ ...ff(c.font), fontSize: 8.5 * k, color: c.gray, margin: 0 }}>View all 48 comments</p>
        </div>
      </div>
    );
  }

  if (style === 'threads') {
    return (
      <div style={shell(14)}>
        <div style={{ ...headerRow, padding: `${11 * k}px ${13 * k}px 0` }}>
          <AvatarMark page={page} size={20} k={k} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 * k, minWidth: 0, flexShrink: 1 }}>
            <span style={{ ...ff(c.font, true), fontSize: 9 * k, color: c.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.firstHandle}
            </span>
            <Check c={c} size={8} k={k} />
          </span>
          <span style={{ ...ff(c.font), fontSize: 9 * k, color: c.faint, flexShrink: 0 }}>· 2h</span>
          {c.watermark ? <Watermark font={c.font} size={8} color={c.faint} k={k} /> : null}
          <span style={{ flex: 1 }} />
          <span style={{ width: 12 * k, height: 12 * k, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'visible', color: c.ink }}>
            <BrandIcon provider="threads" mono className="h-[72%] w-[72%]" />
          </span>
        </div>
        <div style={bodyStyle}>{children}</div>
        <div style={{ padding: `0 ${13 * k}px ${11 * k}px`, display: 'flex', flexDirection: 'column', gap: 6 * k }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 * k }}>
            <ChromeIcon name="ig-heart" size={14 * k} color={c.ink} />
            <ChromeIcon name="ig-comment" size={14 * k} color={c.ink} />
            <ChromeIcon name="th-repost" size={14 * k} color={c.ink} />
            <ChromeIcon name="th-send" size={14 * k} color={c.ink} />
          </div>
          <p style={{ ...ff(c.font), fontSize: 8 * k, color: c.faint, margin: 0 }}>12 replies</p>
        </div>
      </div>
    );
  }

  if (style === 'bluesky') {
    return (
      <div style={shell(14)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 * k, padding: `${11 * k}px ${13 * k}px 0` }}>
          <AvatarMark page={page} size={22} k={k} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 * k }}>
              <span style={{ ...ff(c.font, true), fontSize: 9 * k, color: c.ink }}>{c.name} </span>
              <Check c={c} size={9} k={k} />
              {c.watermark ? <Watermark font={c.font} size={8} color={c.gray} k={k} /> : null}
            </div>
            <p style={{ ...ff(c.font), fontSize: 8 * k, color: c.gray, margin: 0 }}>{c.firstHandle} · 2h</p>
          </div>
        </div>
        <div style={bodyStyle}>{children}</div>
        <div style={{ display: 'flex', alignItems: 'center', padding: `0 ${14 * k}px ${10 * k}px`, gap: 4 * k }}>
          {[
            { icon: 'bsky-comment', count: '12', color: c.gray },
            { icon: 'bsky-repost', count: '48', color: '#2E9E53' },
            { icon: 'bsky-heart', count: '312', color: '#EC245E' },
            { icon: 'bsky-bookmark', count: '', color: c.gray },
            { icon: 'bsky-share', count: '', color: c.gray },
            { icon: 'dots', count: '', color: c.gray },
          ].map((a, i) => (
            <span key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3 * k }}>
              <ChromeIcon name={a.icon} size={14 * k} color={a.color} />
              {a.count ? <span style={{ ...ff(c.font), fontSize: 8 * k, color: c.gray }}>{a.count}</span> : null}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // minimal
  return (
    <div style={{ position: 'relative', ...(fit ? { flexShrink: 1 } : { flex: 1, minHeight: 0 }) }}>
      <div style={{ ...(fit ? { flexShrink: 1, maxHeight: maxH, overflow: 'hidden' } : { flex: 1, minHeight: 0 }), display: 'flex', flexDirection: 'column', gap: 10 * k, backgroundColor: c.cardBg, borderRadius: 14 * k, padding: 13 * k, borderWidth: Math.max(1, k), borderStyle: 'solid', borderColor: '#11111112' }}>
        {children}
      </div>
      {watermark ? (
        <span style={{ position: 'absolute', right: 13 * k, bottom: 13 * k }}>
          <Watermark font={c.font} size={8} color={c.gray} k={k} />
        </span>
      ) : null}
    </div>
  );
}

/* --------------------------------- canvas ---------------------------------- */

export default function StudioCanvas({
  page,
  ratio,
  width,
  watermark,
  frame = true,
}: {
  page: PostPage;
  ratio: number;
  width: number;
  watermark?: boolean;
  frame?: boolean;
}) {
  const w = width;
  const H = w * ratio;
  const k = w / 340;
  const pad = (v: number) => v * k;
  const hasTitle = page.title.position !== 'none' && page.title.text.trim().length > 0;
  const titleOnTop = hasTitle && page.title.position === 'top';
  const titleOnBottom = hasTitle && page.title.position === 'bottom';
  const pfpOnTop = (page.pfp.pfpY ?? 'top') === 'top';
  const cardY = page.cardY ?? 'bottom';
  const groupY = page.cardAuto && hasTitle && page.title.position === 'top' ? 'top' : cardY;
  const stickToCard = page.stickToCard ?? false;
  const wm = watermark ?? page.showWatermark ?? true;

  // auto-height cap math (ports mobile estimation so cards can't spill).
  const canvasH = H;
  const titleLines = hasTitle ? Math.max(1, Math.ceil(page.title.text.trim().length / 26)) : 0;
  const titleH = hasTitle
    ? page.title.size * k * 1.3 * titleLines + ((page.title.subtitle ?? '').trim() ? (page.title.subtitleSize ?? 15) * k * 1.35 : 0)
    : 0;
  const pfpVisible = !(page.pfp.hidden ?? false);
  const socialsBelow = pfpVisible && page.socials.some((s) => s.visible) && (page.pfp.socialPos ?? 'below') === 'below';
  const pfpH = pfpVisible
    ? page.pfp.size * k + pad(4) + (page.pfp.username?.trim() ? pad(page.pfp.handleSize ?? 8.5) + pad(2) : 0) + (socialsBelow ? pad(page.pfp.iconSize ?? 17) + pad(6) : 0)
    : 0;
  const cardMax = Math.max(90, canvasH - pad(16) * 2 - titleH - pfpH - pad(10) * 2);

  const blocks =
    page.blocks.length === 0 ? (
      <p style={{ color: '#787774', textAlign: 'center', marginTop: pad(24), fontSize: pad(13), fontWeight: 600, margin: `${pad(24)}px 0 0` }}>
        Add bullets, table or chart below
      </p>
    ) : (
      page.blocks.map((b) => (
        <BlockView key={b.id} block={b} width={w - pad(16) * 2 - pad(13) * 2} font={page.font ?? 'inter'} zoom={page.contentScale ?? 1} />
      ))
    );

  const titleBlock = hasTitle ? <TitleBlock page={page} k={k} /> : null;
  const pfpRow = <PfpRow page={page} k={k} />;
  const c = chromeCtx(page);

  const content = page.fullCard ? (
    <div style={{ width: w, height: H, borderRadius: pad(14), overflow: 'hidden', backgroundColor: page.cardColor ?? '#FFFFFFF2' }}>
      <Chrome c={c} k={k} fit maxH={H} watermark={wm}>
        {blocks}
      </Chrome>
    </div>
  ) : (
    <div style={{ width: w, height: H, position: 'relative' }}>
      <PatternBackground bg={page.background} width={w} height={H} />
      <div style={{ position: 'absolute', inset: 0, padding: pad(16), display: 'flex', flexDirection: 'column', gap: pad(10) }}>
        {page.cardH || page.cardAuto ? (
          <>
            {!stickToCard && pfpOnTop ? pfpRow : null}
            <div
              style={{
                display: 'flex', flexDirection: 'column', gap: pad(10),
                flexShrink: page.cardAuto ? 1 : 0,
                marginTop: groupY === 'top' ? undefined : 'auto',
                marginBottom: groupY === 'bottom' ? undefined : 'auto',
              }}
            >
              {stickToCard && pfpOnTop ? pfpRow : null}
              {titleOnTop ? titleBlock : null}
              {page.cardH ? (
                <div style={{ height: pad(page.cardH) }}>
                  <Chrome c={c} k={k} watermark={wm}>
                    {blocks}
                  </Chrome>
                </div>
              ) : (
                <Chrome c={c} k={k} fit maxH={cardMax} watermark={wm}>
                  {blocks}
                </Chrome>
              )}
              {titleOnBottom ? titleBlock : null}
              {stickToCard && !pfpOnTop ? pfpRow : null}
            </div>
            {!stickToCard && !pfpOnTop ? pfpRow : null}
          </>
        ) : (
          <>
            {pfpOnTop ? pfpRow : null}
            {titleOnTop ? titleBlock : null}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Chrome c={c} k={k} watermark={wm}>
                {blocks}
              </Chrome>
            </div>
            {titleOnBottom ? titleBlock : null}
            {!pfpOnTop ? pfpRow : null}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div
      data-studio-canvas
      data-ratio={ratio}
      style={{
        width: w, height: H, borderRadius: frame ? pad(14) : 0, overflow: 'hidden',
        backgroundColor: '#fff', position: 'relative',
        boxShadow: frame ? '0 4px 10px rgba(17,17,17,0.05)' : 'none',
      }}
    >
      {content}
      {frame ? (
        <span style={{ pointerEvents: 'none', position: 'absolute', inset: 0, borderRadius: pad(14), borderWidth: 1, borderStyle: 'solid', borderColor: '#EAEAEA' }} />
      ) : null}
    </div>
  );
}

/* --------------------------------- bits ---------------------------------- */

function AvatarMark({ page, size, k }: { page: PostPage; size: number; k: number }) {
  const d = size * k;
  if (page.pfp.uri) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={page.pfp.uri} alt="" style={{ width: d, height: d, borderRadius: d / 2, objectFit: 'cover' }} />;
  }
  return (
    <span
      style={{
        width: d, height: d, borderRadius: d / 2, backgroundColor: '#111111',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: d * 0.38,
      }}
    >
      Y
    </span>
  );
}

function Watermark({ font, size, color, k }: { font: FontId; size: number; color: string; k: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2 * k, flexShrink: 0 }}>
      <span style={{ ...ff(font), fontSize: size * k, color }}>made with</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bolt.png" alt="" data-embed width={Math.round((size + 1) * k)} height={Math.round((size + 1) * k)} style={{ borderRadius: 2 * k }} />
      <span style={{ ...ff(font, true), fontSize: size * k, color }}>Sosial</span>
    </span>
  );
}

function TitleBlock({ page, k }: { page: PostPage; k: number }) {
  const t = page.title;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 * k }}>
      <p
        style={{
          ...ff(t.font, t.bold, t.italic), fontSize: t.size * k, color: t.color,
          textAlign: t.align, lineHeight: 1.28, letterSpacing: -0.4, margin: 0,
          textShadow: '0 1px 2px rgba(0,0,0,0.13)',
        }}
      >
        {t.text}
      </p>
      {t.subtitle?.trim() ? (
        <p
          style={{
            ...ff(t.font, false, t.italic), fontSize: (t.subtitleSize ?? 15) * k,
            color: t.subtitleColor ?? t.color, textAlign: t.align, lineHeight: 1.32, margin: 0,
          }}
        >
          {t.subtitle}
        </p>
      ) : null}
    </div>
  );
}

function PfpRow({ page, k }: { page: PostPage; k: number }) {
  if (page.pfp.hidden ?? false) return null;
  const visibleSocials = page.socials.filter((s) => s.visible);
  const socialPos = page.pfp.socialPos ?? 'below';
  const badgeBg = page.pfp.badgeBg ?? true;
  const badgeRows = page.pfp.badgeRows ?? 1;
  const handleColor = page.pfp.handleColor ?? '#FFFFFF';
  const handleSize = page.pfp.handleSize ?? 8.5;
  const iconSize = page.pfp.iconSize ?? 17;
  const iconOutline = page.pfp.iconOutline ?? false;
  const socialGap = page.pfp.socialGap ?? 6;
  const align = page.pfp.align ?? 'left';
  const borderW = page.pfp.borderW ?? 2;
  const badgeSurface = badgeBg ? '#111111' : (page.background.color ?? '#FFFFFF');
  const surfaceDark = badgeBg ? true : contrastRatio('#111111', badgeSurface) < contrastRatio('#FFFFFF', badgeSurface);
  const ringColor = surfaceDark ? '#FFFFFF' : '#111111';
  const dir = socialPos === 'below' ? 'column' : 'row';
  const cross = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

  return (
    <div
      style={{
        display: 'flex', flexDirection: dir as 'column' | 'row',
        alignItems: dir === 'column' ? cross : 'center',
        justifyContent: dir === 'column' ? 'flex-start' : cross,
        gap: socialGap * k,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 * k }}>
        {page.pfp.uri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.pfp.uri}
            alt=""
            style={{
              width: page.pfp.size * k, height: page.pfp.size * k,
              borderRadius: page.pfp.shape === 'circle' ? (page.pfp.size * k) / 2 : 12 * k,
              borderWidth: borderW * k, borderStyle: 'solid', borderColor: '#fff', objectFit: 'cover',
            }}
          />
        ) : (
          <span
            style={{
              width: page.pfp.size * k, height: page.pfp.size * k,
              borderRadius: page.pfp.shape === 'circle' ? (page.pfp.size * k) / 2 : 12 * k,
              backgroundColor: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderWidth: borderW * k, borderStyle: 'solid', borderColor: '#fff',
              color: '#fff', fontWeight: 800, fontSize: 13 * k,
            }}
          >
            YOU
          </span>
        )}
        {page.pfp.username?.trim() ? (
          <span style={{ ...ff(page.font ?? 'jakarta', true), color: handleColor, fontSize: handleSize * k, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
            {page.pfp.username}
          </span>
        ) : null}
      </div>
      {visibleSocials.length > 0 ? (
        <div
          style={{
            display: 'flex', flexDirection: 'row', flexWrap: badgeRows === 2 ? 'wrap' : 'nowrap',
            justifyContent: dir === 'column' ? cross : 'center', alignItems: 'center', gap: socialGap * k,
            ...(badgeRows === 2 ? { maxWidth: 220 * k } : {}),
          }}
        >
          {visibleSocials.map((sl) => {
            const brand = providerMeta(sl.platform).color;
            const clash = contrastRatio(brand, badgeSurface) < 3;
            const inverted = !iconOutline && clash;
            const glyphColor = iconOutline ? (clash ? ringColor : brand) : inverted ? brand : '#fff';
            return (
              <span
                key={sl.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3 * k,
                  backgroundColor: badgeBg ? '#111111E8' : 'transparent',
                  borderRadius: 8 * k, padding: `${4 * k}px ${6 * k}px`,
                  borderWidth: badgeBg ? Math.max(1, k) : 0, borderStyle: 'solid', borderColor: '#FFFFFF2E',
                }}
              >
                <span
                  style={{
                    width: iconSize * k, height: iconSize * k, borderRadius: (iconSize * k) / 2,
                    backgroundColor: iconOutline ? 'transparent' : inverted ? '#FFFFFF' : brand,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderWidth: iconOutline ? Math.max(1, k) : (!badgeBg && surfaceDark ? Math.max(1, k) : 0),
                    borderStyle: 'solid',
                    borderColor: iconOutline
                      ? (clash ? ringColor : brand)
                      : (!badgeBg && surfaceDark ? '#FFFFFF45' : 'transparent'),
                    color: glyphColor,
                  }}
                >
                  {sl.platform === 'whatsapp' ? (
                    <span style={{ ...ff(sl.font, true), fontSize: iconSize * k * 0.42, color: glyphColor }}>WA</span>
                  ) : (
                    <BrandIcon
                      provider={sl.platform as 'instagram'}
                      mono
                      className="h-[62%] w-[62%]"
                    />
                  )}
                </span>
                {sl.handle ? (
                  <span style={{ ...ff(sl.font, sl.bold, sl.italic), color: handleColor, fontSize: handleSize * k, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                    {sl.handle}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
