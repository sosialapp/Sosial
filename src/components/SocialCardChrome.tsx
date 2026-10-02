import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { Svg, Path, G, Defs, ClipPath, Rect } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import FontAwesome from '@expo/vector-icons/build/FontAwesome';
import { PostPage } from '../types';
import { F, FontId } from '../utils/fonts';
import { SocialGlyph, ActionIcon, VERIFIED_SEAL } from './ui';

interface ChromeProps {
  page: PostPage;
  pad: (v: number) => number;
  /** when true the card hugs its content (auto height) instead of filling the canvas */
  fit?: boolean;
  /** hard ceiling for the auto height — content scales down rather than clipping */
  maxH?: number;
  /** render the "made with Sosial" badge (free-plan watermark) */
  watermark?: boolean;
  children: React.ReactNode;
}

function useChrome(page: PostPage) {
  const firstHandle = page.pfp.customHandle?.trim() || page.socials.find((s) => s.visible && s.handle)?.handle || '@yourhandle';
  const uni = page.pfp.username?.trim();
  const name = uni || firstHandle.replace(/^@/, '');
  return { firstHandle, name };
}

function Avatar({ page, pad, size }: { page: PostPage; pad: (v: number) => number; size: number }) {
  const d = pad(size);
  if (page.pfp.uri) {
    return <Image source={{ uri: page.pfp.uri }} style={{ width: d, height: d, borderRadius: d / 2 }} />;
  }
  return (
    <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: d * 0.38 }}>Y</Text>
    </View>
  );
}

/** In-card attribution badge: "made with (logo) Sosial", sized/colored to blend into the chrome. */
function Watermark({ font, pad, size, color }: { font: FontId; pad: (v: number) => number; size: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(2), flexShrink: 0 }}>
      <Text style={{ ...F(font), fontSize: pad(size), color }}>Made with</Text>
      <Image source={require('../../assets/watermark.png')} style={{ width: pad(size + 1), height: pad(size + 1), borderRadius: pad(2) }} />
      <Text style={{ ...F(font, true), fontSize: pad(size), color }}>sosial.app</Text>
    </View>
  );
}

/** Luminance check — dark cards get light chrome ink, light cards get dark. */
function isDarkHex(hex: string): boolean {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
}

/** Auto-fit: measures available body height vs natural content height and
 * scales content down (min 45%) so nothing ever clips out of the fixed card. */
function AutoFit({ style, children, fit, maxH }: { style: any; children: React.ReactNode; fit?: boolean; maxH?: number }) {
  const [avail, setAvail] = useState(0);
  const [natural, setNatural] = useState(0);
  const ratio = avail > 0 && natural > avail + 1 ? Math.max(0.45, avail / natural) : 1;
  const onOuter = (e: any) => {
    const h = e.nativeEvent.layout.height;
    setAvail((p) => (Math.abs(p - h) > 1 ? h : p));
  };
  const onInner = (e: any) => {
    const h = e.nativeEvent.layout.height;
    setNatural((p) => (Math.abs(p - h) > 1 ? h : p));
  };
  const base = fit
    ? { ...style, flex: undefined, minHeight: undefined, flexShrink: 1, maxHeight: maxH, overflow: 'hidden' as const }
    : style;
  return (
    <View onLayout={onOuter} style={[base, ratio < 1 ? { height: Math.max(1, Math.round(natural * ratio)), overflow: 'hidden' } : null]}>
      <View
        onLayout={onInner}
        style={
          ratio < 1
            ? { width: '100%', transform: [{ scale: ratio }], transformOrigin: ['50%', '0%', 0] as any }
            : { width: '100%' }
        }
      >
        {children}
      </View>
    </View>
  );
}

/** Platform-authentic card templates wrapping the content blocks. */
export default function SocialCardChrome({ page, pad, fit, maxH, watermark, children }: ChromeProps) {
  const style = page.cardStyle ?? 'minimal';
  const cardBg = page.cardColor ?? '#FFFFFFF2';
  const { firstHandle, name } = useChrome(page);
  const font = page.font ?? 'inter';
  const dark = isDarkHex(cardBg);
  const ink = dark ? '#FFFFFF' : '#111111';
  const gray = dark ? '#CFC9BD' : '#65676B';
  const faint = dark ? '#A8A29E' : '#B0B3B8';
  const hairline = dark ? '#FFFFFF24' : '#11111114';
  const showCheck = page.verified ?? true;
  const sealed = page.cardStyle === 'facebook' || page.cardStyle === 'instagram' || page.cardStyle === 'threads';
  const check = (size: number) => {
    if (!showCheck) return null;
    if (!sealed) return <Ionicons name="checkmark-circle" size={pad(size)} color="#1D9BF0" />;
    return (
      <Svg width={pad(size)} height={pad(size)} viewBox="0 0 24 24">
        <Path d={VERIFIED_SEAL} fill="#1D9BF0" />
        <Path d="m8 12.5 2.5 2.5L16 9.5" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  };
  const rootFlex = fit
    ? { flexShrink: 1 as const, maxHeight: maxH, overflow: 'hidden' as const }
    : { flex: 1 as const, minHeight: 0 as const };

  const bodyPad = pad(13);
  const body = (topExtra: boolean, bottomExtra: boolean) => ({
    padding: bodyPad,
    paddingTop: topExtra ? pad(8) : bodyPad,
    paddingBottom: bottomExtra ? pad(8) : bodyPad,
    gap: pad(10),
    ...rootFlex,
  });

  if (style === 'facebook') {
    return (
      <View style={{ ...rootFlex, backgroundColor: cardBg, borderRadius: pad(8), borderWidth: pad(1), borderColor: '#11111112', overflow: 'hidden' }}>
        {/* author header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(7), paddingHorizontal: pad(12), paddingTop: pad(10) }}>
          <Avatar page={page} pad={pad} size={24} />
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(4) }}>
              <Text style={{ ...F(font, true), fontSize: pad(9.5), color: ink, flexShrink: 1 }} numberOfLines={1}>{name}</Text>
              {check(9)}
              {watermark ? <Watermark font={font} pad={pad} size={8} color={gray} /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={{ ...F(font), fontSize: pad(7.5), color: gray }}>2h · Public</Text>
              <Ionicons name="globe-outline" size={pad(8)} color={gray} />
            </View>
          </View>
          <Ionicons name="ellipsis-horizontal" size={pad(12)} color={gray} />
        </View>
        <AutoFit fit={fit} maxH={maxH} style={body(true, true)}>{children}</AutoFit>
        {/* stats */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad(12), paddingBottom: pad(7) }}>
          <View style={{ width: pad(15), height: pad(15), borderRadius: pad(7.5), backgroundColor: '#1877F2', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome name="thumbs-up" size={pad(9)} color="#fff" />
          </View>
          <Text style={{ ...F(font), fontSize: pad(8.5), color: gray, marginLeft: 5 }}>1.2K</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ ...F(font), fontSize: pad(8.5), color: gray }}>48 comments · 12 shares</Text>
        </View>
        {/* actions */}
        <View style={{ borderTopWidth: pad(1), borderTopColor: hairline, flexDirection: 'row', paddingVertical: pad(7) }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <ActionIcon name="fb-like" size={pad(12)} color={gray} />
            <Text style={{ ...F(font), fontSize: pad(9), color: gray }}>Like</Text>
          </View>
          {[
            { icon: 'fb-comment', label: 'Comment' },
            { icon: 'fb-share', label: 'Share' },
          ].map((a) => (
            <View key={a.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <ActionIcon name={a.icon as 'fb-comment' | 'fb-share'} size={pad(12)} color={gray} />
              <Text style={{ ...F(font), fontSize: pad(9), color: gray }}>{a.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (style === 'x') {
    return (
      <View style={{ ...rootFlex, backgroundColor: cardBg, borderRadius: pad(14), borderWidth: pad(1), borderColor: hairline, overflow: 'hidden' }}>
        {/* author header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(7), paddingHorizontal: pad(13), paddingTop: pad(11) }}>
          <Avatar page={page} pad={pad} size={22} />
          <Text style={{ ...F(font, true), fontSize: pad(9), color: ink, flexShrink: 1 }} numberOfLines={1}>
            {name} {check(9)}
          </Text>
          <Text style={{ ...F(font), fontSize: pad(8.5), color: gray, flexShrink: 1 }} numberOfLines={1}>
            {firstHandle} · 2h
          </Text>
          {watermark ? <Watermark font={font} pad={pad} size={8} color={gray} /> : null}
          <View style={{ flex: 1 }} />
          <Ionicons name="ellipsis-horizontal" size={pad(11)} color={gray} />
        </View>
        <AutoFit fit={fit} maxH={maxH} style={body(true, true)}>{children}</AutoFit>
        {/* Engagement strip (user-supplied art, 357×54) replaces the glyph
            action row — full-width, aspect-preserved. */}
        <View style={{ paddingHorizontal: pad(14), paddingTop: pad(3), paddingBottom: pad(10) }}>
          <Svg width="100%" height={pad(20)} viewBox="0 0 357 54">
            <Defs>
              <ClipPath id="xstrip-clip">
                <Rect x="84.1383" y="15.2881" width="22.9322" height="22.9322" />
              </ClipPath>
            </Defs>
            <G fill="#6D6D6D">
              <Path d="M1.67313 24.8432C1.67313 20.6199 5.09766 17.1992 9.32196 17.1992H13.4937C17.7839 17.1992 21.261 20.6772 21.261 24.9674C21.261 27.7957 19.7255 30.3947 17.2517 31.7611L9.55606 36.0227V32.4968H9.49204C5.20182 32.5924 1.67313 29.143 1.67313 24.8432ZM9.32196 19.1102C6.15254 19.1102 3.58414 21.6805 3.58414 24.8432C3.58414 28.0633 6.2309 30.6527 9.44905 30.5858L9.78443 30.5763H11.4671V32.7739L16.3277 30.089C18.1919 29.057 19.35 27.0982 19.35 24.9674C19.35 21.7283 16.7281 19.1102 13.4937 19.1102H9.32196Z" />
              <Path d="M30.5429 32.7542H29.3187V23.5051C29.2241 23.5997 29.0848 23.7092 28.9006 23.8336C28.7215 23.953 28.5174 24.0725 28.2885 24.1919C28.0646 24.3113 27.8257 24.4233 27.5719 24.5278C27.323 24.6323 27.0792 24.7145 26.8403 24.7742V23.535C27.1091 23.4603 27.3927 23.3608 27.6913 23.2364C27.9949 23.107 28.291 22.9652 28.5796 22.8109C28.8733 22.6516 29.1495 22.4874 29.4082 22.3182C29.667 22.144 29.891 21.9748 30.0801 21.8106H30.5429V32.7542ZM40.4936 29.7234C40.4936 30.2061 40.4016 30.6466 40.2174 31.0447C40.0383 31.4378 39.782 31.7762 39.4485 32.0599C39.1201 32.3386 38.7244 32.5551 38.2616 32.7094C37.7988 32.8636 37.2887 32.9408 36.7313 32.9408C35.7111 32.9408 34.8999 32.7467 34.2978 32.3585V31.0447C35.0194 31.612 35.8455 31.8957 36.7761 31.8957C37.1493 31.8957 37.4853 31.8484 37.7839 31.7539C38.0874 31.6593 38.3462 31.5224 38.5602 31.3433C38.7792 31.1641 38.9459 30.9476 39.0604 30.6938C39.1798 30.44 39.2395 30.1539 39.2395 29.8354C39.2395 28.4369 38.2442 27.7377 36.2536 27.7377H35.3652V26.7001H36.2088C37.9705 26.7001 38.8513 26.0432 38.8513 24.7294C38.8513 23.5151 38.1795 22.9079 36.8358 22.9079C36.0794 22.9079 35.3702 23.1618 34.7083 23.6694V22.4824C35.3901 22.0744 36.2013 21.8703 37.1419 21.8703C37.5898 21.8703 37.9954 21.9325 38.3587 22.0569C38.722 22.1814 39.033 22.3555 39.2918 22.5795C39.5506 22.8034 39.7496 23.0722 39.889 23.3857C40.0333 23.6992 40.1054 24.0451 40.1054 24.4233C40.1054 25.8317 39.3938 26.7374 37.9705 27.1405V27.1704C38.3338 27.2102 38.6697 27.2998 38.9782 27.4391C39.2868 27.5735 39.553 27.7502 39.777 27.9691C40.0009 28.1881 40.1751 28.4469 40.2995 28.7455C40.4289 29.0391 40.4936 29.3651 40.4936 29.7234ZM43.2855 32.9184C43.0566 32.9184 42.86 32.8363 42.6958 32.672C42.5365 32.5078 42.4569 32.3112 42.4569 32.0823C42.4569 31.8534 42.5365 31.6568 42.6958 31.4926C42.86 31.3234 43.0566 31.2388 43.2855 31.2388C43.5194 31.2388 43.7185 31.3234 43.8827 31.4926C44.0469 31.6568 44.129 31.8534 44.129 32.0823C44.129 32.3112 44.0469 32.5078 43.8827 32.672C43.7185 32.8363 43.5194 32.9184 43.2855 32.9184ZM50.3398 32.7542H49.1156V23.5051C49.021 23.5997 48.8817 23.7092 48.6976 23.8336C48.5184 23.953 48.3144 24.0725 48.0854 24.1919C47.8615 24.3113 47.6226 24.4233 47.3688 24.5278C47.12 24.6323 46.8761 24.7145 46.6372 24.7742V23.535C46.906 23.4603 47.1896 23.3608 47.4882 23.2364C47.7918 23.107 48.0879 22.9652 48.3766 22.8109C48.6702 22.6516 48.9464 22.4874 49.2052 22.3182C49.4639 22.144 49.6879 21.9748 49.877 21.8106H50.3398V32.7542ZM60.7608 32.7542H59.0439L55.6698 29.0814H55.6399V32.7542H54.4157V21.4374H55.6399V28.6111H55.6698L58.8797 25.1101H60.4846L56.9388 28.7978L60.7608 32.7542Z" />
              <G clipPath="url(#xstrip-clip)">
                <Path d="M88.4382 18.9955L92.673 22.9513L91.3697 24.3463L89.3937 22.5022V30.5762C89.3937 31.6273 90.2498 32.4872 91.3047 32.4872H96.56V34.3983H91.3047C89.194 34.3983 87.4827 32.6879 87.4827 30.5762V22.5022L85.5067 24.3463L84.2034 22.9513L88.4382 18.9955ZM99.9043 21.0212H94.649V19.1101H99.9043C102.015 19.1101 103.726 20.8205 103.726 22.9322V31.0062L105.702 29.1621L107.006 30.5571L102.771 34.5129L98.536 30.5571L99.8393 29.1621L101.815 31.0062V22.9322C101.815 21.8811 100.959 21.0212 99.9043 21.0212Z" />
              </G>
              <Path d="M114.681 32.7542H113.457V23.5052C113.362 23.5998 113.223 23.7092 113.039 23.8337C112.86 23.9531 112.656 24.0725 112.427 24.192C112.203 24.3114 111.964 24.4234 111.71 24.5279C111.461 24.6324 111.218 24.7145 110.979 24.7742V23.5351C111.247 23.4604 111.531 23.3609 111.83 23.2365C112.133 23.1071 112.429 22.9652 112.718 22.811C113.012 22.6517 113.288 22.4875 113.547 22.3183C113.805 22.1441 114.029 21.9749 114.218 21.8107H114.681V32.7542ZM122.922 32.7542H121.698V23.5052C121.604 23.5998 121.464 23.7092 121.28 23.8337C121.101 23.9531 120.897 24.0725 120.668 24.192C120.444 24.3114 120.205 24.4234 119.951 24.5279C119.703 24.6324 119.459 24.7145 119.22 24.7742V23.5351C119.489 23.4604 119.772 23.3609 120.071 23.2365C120.374 23.1071 120.671 22.9652 120.959 22.811C121.253 22.6517 121.529 22.4875 121.788 22.3183C122.047 22.1441 122.271 21.9749 122.46 21.8107H122.922V32.7542ZM127.424 32.9184C127.195 32.9184 126.998 32.8363 126.834 32.6721C126.675 32.5079 126.595 32.3113 126.595 32.0824C126.595 31.8534 126.675 31.6569 126.834 31.4926C126.998 31.3234 127.195 31.2388 127.424 31.2388C127.658 31.2388 127.857 31.3234 128.021 31.4926C128.185 31.6569 128.267 31.8534 128.267 32.0824C128.267 32.3113 128.185 32.5079 128.021 32.6721C127.857 32.8363 127.658 32.9184 127.424 32.9184ZM134.836 24.8563C134.836 24.5279 134.784 24.2417 134.68 23.9979C134.58 23.754 134.441 23.5525 134.262 23.3932C134.087 23.229 133.881 23.1071 133.642 23.0274C133.403 22.9478 133.144 22.908 132.866 22.908C132.627 22.908 132.393 22.9404 132.164 23.005C131.935 23.0697 131.711 23.1593 131.492 23.2738C131.278 23.3882 131.069 23.5251 130.865 23.6844C130.666 23.8436 130.479 24.0203 130.305 24.2144V22.9005C130.649 22.5671 131.032 22.3133 131.455 22.1391C131.883 21.96 132.403 21.8704 133.015 21.8704C133.453 21.8704 133.859 21.9351 134.232 22.0645C134.605 22.1889 134.929 22.373 135.202 22.6169C135.476 22.8607 135.69 23.1618 135.844 23.5201C136.003 23.8784 136.083 24.289 136.083 24.7518C136.083 25.1748 136.033 25.558 135.934 25.9014C135.839 26.2448 135.692 26.5683 135.493 26.8719C135.299 27.1754 135.053 27.4666 134.754 27.7453C134.456 28.024 134.105 28.3076 133.702 28.5963C133.199 28.9546 132.784 29.2606 132.455 29.5144C132.132 29.7683 131.873 30.0071 131.679 30.2311C131.49 30.45 131.355 30.6715 131.276 30.8955C131.201 31.1144 131.164 31.3682 131.164 31.6569H136.494V32.7542H129.887V32.2242C129.887 31.7664 129.937 31.3633 130.037 31.0149C130.136 30.6665 130.3 30.3356 130.529 30.0221C130.758 29.7085 131.057 29.395 131.425 29.0815C131.798 28.768 132.254 28.4146 132.791 28.0215C133.179 27.7428 133.503 27.4765 133.762 27.2227C134.025 26.9689 134.237 26.7151 134.396 26.4613C134.555 26.2075 134.667 25.9512 134.732 25.6924C134.802 25.4287 134.836 25.15 134.836 24.8563ZM144.899 32.7542H143.182L139.808 29.0815H139.778V32.7542H138.554V21.4374H139.778V28.6112H139.808L143.018 25.1102H144.623L141.077 28.7978L144.899 32.7542Z" />
              <Path d="M184.231 20.5433C183.063 20.486 181.671 21.0306 180.514 22.6072L179.745 23.6487L178.975 22.6072C177.816 21.0306 176.423 20.486 175.256 20.5433C174.068 20.6102 173.011 21.2886 172.475 22.3683C171.948 23.4385 171.87 25.0247 172.933 26.9739C173.959 28.8562 176.045 31.0539 179.745 33.2898C183.442 31.0539 185.527 28.8562 186.554 26.9739C187.615 25.0247 187.538 23.4385 187.009 22.3683C186.473 21.2886 185.418 20.6102 184.231 20.5433ZM188.231 27.8912C186.941 30.2608 184.409 32.7834 180.225 35.2199L179.745 35.5066L179.263 35.2199C175.079 32.7834 172.547 30.2608 171.254 27.8912C169.955 25.5024 169.907 23.2474 170.763 21.5179C171.61 19.8076 173.292 18.7374 175.159 18.6419C176.737 18.5559 178.377 19.1769 179.744 20.5624C181.109 19.1769 182.75 18.5559 184.326 18.6419C186.193 18.7374 187.875 19.8076 188.723 21.5179C189.579 23.2474 189.531 25.5024 188.231 27.8912Z" />
              <Path d="M200.529 29.7235C200.529 30.2062 200.437 30.6466 200.253 31.0447C200.074 31.4379 199.817 31.7763 199.484 32.06C199.155 32.3387 198.76 32.5551 198.297 32.7094C197.834 32.8637 197.324 32.9408 196.767 32.9408C195.747 32.9408 194.935 32.7467 194.333 32.3586V31.0447C195.055 31.6121 195.881 31.8957 196.811 31.8957C197.185 31.8957 197.521 31.8485 197.819 31.7539C198.123 31.6594 198.382 31.5225 198.596 31.3433C198.815 31.1642 198.981 30.9477 199.096 30.6939C199.215 30.4401 199.275 30.1539 199.275 29.8354C199.275 28.437 198.28 27.7378 196.289 27.7378H195.401V26.7002H196.244C198.006 26.7002 198.887 26.0433 198.887 24.7294C198.887 23.5152 198.215 22.908 196.871 22.908C196.115 22.908 195.406 23.1618 194.744 23.6694V22.4825C195.426 22.0744 196.237 21.8704 197.177 21.8704C197.625 21.8704 198.031 21.9326 198.394 22.057C198.757 22.1814 199.068 22.3556 199.327 22.5795C199.586 22.8035 199.785 23.0722 199.924 23.3858C200.069 23.6993 200.141 24.0452 200.141 24.4234C200.141 25.8318 199.429 26.7375 198.006 27.1406V27.1705C198.369 27.2103 198.705 27.2999 199.014 27.4392C199.322 27.5736 199.588 27.7502 199.812 27.9692C200.036 28.1882 200.211 28.447 200.335 28.7456C200.464 29.0392 200.529 29.3651 200.529 29.7235ZM209.285 29.3577C209.285 29.8802 209.201 30.3605 209.032 30.7984C208.862 31.2363 208.628 31.6146 208.33 31.9331C208.031 32.2516 207.675 32.5004 207.262 32.6796C206.849 32.8537 206.401 32.9408 205.919 32.9408C205.381 32.9408 204.898 32.8289 204.47 32.6049C204.047 32.381 203.687 32.06 203.388 31.6419C203.094 31.2189 202.871 30.7039 202.716 30.0967C202.562 29.4896 202.485 28.8053 202.485 28.0439C202.485 27.1132 202.587 26.2697 202.791 25.5133C203 24.7518 203.294 24.1024 203.672 23.5649C204.055 23.0225 204.515 22.6044 205.053 22.3108C205.59 22.0172 206.19 21.8704 206.852 21.8704C207.588 21.8704 208.181 21.9724 208.628 22.1764V23.3335C208.076 23.0498 207.494 22.908 206.882 22.908C206.404 22.908 205.973 23.015 205.59 23.229C205.207 23.443 204.879 23.7466 204.605 24.1397C204.331 24.5279 204.12 24.9982 203.97 25.5506C203.826 26.103 203.754 26.7176 203.754 27.3944H203.784C204.276 26.5036 205.09 26.0582 206.225 26.0582C206.693 26.0582 207.113 26.1378 207.486 26.2971C207.865 26.4563 208.186 26.6828 208.449 26.9764C208.718 27.265 208.925 27.6109 209.069 28.014C209.213 28.4171 209.285 28.865 209.285 29.3577ZM208.031 29.5144C208.031 29.1412 207.984 28.8053 207.889 28.5067C207.795 28.2081 207.658 27.9543 207.479 27.7453C207.305 27.5362 207.088 27.377 206.829 27.2675C206.571 27.153 206.277 27.0958 205.949 27.0958C205.645 27.0958 205.364 27.153 205.105 27.2675C204.846 27.382 204.622 27.5387 204.433 27.7378C204.244 27.9319 204.095 28.1608 203.985 28.4246C203.881 28.6834 203.829 28.9596 203.829 29.2532C203.829 29.6214 203.881 29.9673 203.985 30.2908C204.09 30.6093 204.237 30.888 204.426 31.1269C204.615 31.3657 204.839 31.5549 205.098 31.6942C205.361 31.8286 205.652 31.8957 205.971 31.8957C206.279 31.8957 206.561 31.8385 206.814 31.7241C207.068 31.6046 207.285 31.4404 207.464 31.2314C207.643 31.0224 207.782 30.7735 207.882 30.4849C207.981 30.1913 208.031 29.8678 208.031 29.5144ZM211.562 32.9184C211.333 32.9184 211.137 32.8363 210.972 32.6721C210.813 32.5079 210.734 32.3113 210.734 32.0824C210.734 31.8534 210.813 31.6569 210.972 31.4926C211.137 31.3234 211.333 31.2388 211.562 31.2388C211.796 31.2388 211.995 31.3234 212.159 31.4926C212.324 31.6569 212.406 31.8534 212.406 32.0824C212.406 32.3113 212.324 32.5079 212.159 32.6721C211.995 32.8363 211.796 32.9184 211.562 32.9184ZM220.326 29.7235C220.326 30.2062 220.234 30.6466 220.05 31.0447C219.871 31.4379 219.614 31.7763 219.281 32.06C218.952 32.3387 218.557 32.5551 218.094 32.7094C217.631 32.8637 217.121 32.9408 216.564 32.9408C215.543 32.9408 214.732 32.7467 214.13 32.3586V31.0447C214.852 31.6121 215.678 31.8957 216.608 31.8957C216.982 31.8957 217.318 31.8485 217.616 31.7539C217.92 31.6594 218.179 31.5225 218.393 31.3433C218.611 31.1642 218.778 30.9477 218.893 30.6939C219.012 30.4401 219.072 30.1539 219.072 29.8354C219.072 28.437 218.077 27.7378 216.086 27.7378H215.198V26.7002H216.041C217.803 26.7002 218.684 26.0433 218.684 24.7294C218.684 23.5152 218.012 22.908 216.668 22.908C215.912 22.908 215.203 23.1618 214.541 23.6694V22.4825C215.222 22.0744 216.034 21.8704 216.974 21.8704C217.422 21.8704 217.828 21.9326 218.191 22.057C218.554 22.1814 218.865 22.3556 219.124 22.5795C219.383 22.8035 219.582 23.0722 219.721 23.3858C219.866 23.6993 219.938 24.0452 219.938 24.4234C219.938 25.8318 219.226 26.7375 217.803 27.1406V27.1705C218.166 27.2103 218.502 27.2999 218.811 27.4392C219.119 27.5736 219.385 27.7502 219.609 27.9692C219.833 28.1882 220.007 28.447 220.132 28.7456C220.261 29.0392 220.326 29.3651 220.326 29.7235ZM229.037 32.7542H227.321L223.946 29.0815H223.917V32.7542H222.692V21.4374H223.917V28.6112H223.946L227.156 25.1102H228.761L225.215 28.7978L229.037 32.7542Z" />
              <Path d="M260.776 35.3539V18.1547H262.687V35.3539H260.776ZM269.614 35.3539V23.41H271.525V35.3539H269.614ZM256.237 35.3539L256.241 25.7988H258.152L258.148 35.3539H256.237ZM265.073 35.3539V28.6653H266.984V35.3539H265.073Z" />
              <Path d="M285.048 26.7599C285.048 27.7403 284.951 28.6137 284.757 29.3801C284.563 30.1415 284.279 30.7885 283.906 31.321C283.533 31.8485 283.077 32.2516 282.54 32.5303C282.002 32.804 281.39 32.9408 280.703 32.9408C279.997 32.9408 279.375 32.8164 278.837 32.5676V31.3956C279.429 31.729 280.061 31.8957 280.733 31.8957C281.216 31.8957 281.647 31.7962 282.025 31.5972C282.408 31.3981 282.731 31.1094 282.995 30.7312C283.259 30.348 283.461 29.8777 283.6 29.3204C283.739 28.763 283.809 28.1235 283.809 27.4019H283.779C283.321 28.3225 282.525 28.7829 281.39 28.7829C280.932 28.7829 280.512 28.7033 280.129 28.544C279.745 28.3798 279.415 28.1509 279.136 27.8572C278.857 27.5586 278.641 27.2053 278.486 26.7972C278.332 26.3891 278.255 25.9388 278.255 25.4461C278.255 24.9186 278.34 24.4358 278.509 23.9979C278.683 23.5599 278.922 23.1842 279.225 22.8707C279.534 22.5522 279.897 22.3058 280.315 22.1317C280.738 21.9575 281.199 21.8704 281.696 21.8704C282.234 21.8704 282.709 21.9799 283.122 22.1988C283.54 22.4128 283.891 22.7288 284.175 23.1469C284.458 23.5599 284.675 24.07 284.824 24.6772C284.973 25.2843 285.048 25.9786 285.048 26.7599ZM283.727 25.6626C283.727 25.2495 283.672 24.8738 283.563 24.5354C283.458 24.1969 283.311 23.9083 283.122 23.6694C282.933 23.4256 282.707 23.2389 282.443 23.1096C282.184 22.9752 281.9 22.908 281.592 22.908C281.298 22.908 281.024 22.9677 280.771 23.0872C280.517 23.2016 280.295 23.3659 280.106 23.5798C279.922 23.7889 279.775 24.0402 279.666 24.3338C279.561 24.6224 279.509 24.9385 279.509 25.2818C279.509 25.6601 279.559 25.9985 279.658 26.2971C279.763 26.5957 279.91 26.8495 280.099 27.0585C280.288 27.2625 280.514 27.4193 280.778 27.5288C281.047 27.6383 281.343 27.693 281.666 27.693C281.95 27.693 282.216 27.6408 282.465 27.5362C282.719 27.4268 282.938 27.2824 283.122 27.1033C283.311 26.9191 283.458 26.7052 283.563 26.4613C283.672 26.2125 283.727 25.9462 283.727 25.6626ZM293.334 22.7587C293.17 23.0424 292.971 23.3957 292.737 23.8187C292.508 24.2417 292.264 24.717 292.005 25.2445C291.747 25.772 291.483 26.3394 291.214 26.9465C290.945 27.5537 290.694 28.1807 290.46 28.8277C290.226 29.4746 290.02 30.1315 289.841 30.7984C289.666 31.4603 289.539 32.1122 289.46 32.7542H288.146C288.236 32.1172 288.372 31.4678 288.557 30.8059C288.746 30.139 288.957 29.4871 289.191 28.8501C289.43 28.2081 289.681 27.591 289.945 26.9988C290.209 26.4066 290.465 25.8616 290.714 25.364C290.963 24.8663 291.189 24.4284 291.393 24.0501C291.602 23.6669 291.769 23.3683 291.893 23.1543H286.526V22.0495H293.334V22.7587ZM295.7 32.9184C295.472 32.9184 295.275 32.8363 295.111 32.6721C294.951 32.5079 294.872 32.3113 294.872 32.0824C294.872 31.8534 294.951 31.6569 295.111 31.4926C295.275 31.3234 295.472 31.2388 295.7 31.2388C295.934 31.2388 296.133 31.3234 296.298 31.4926C296.462 31.6569 296.544 31.8534 296.544 32.0824C296.544 32.3113 296.462 32.5079 296.298 32.6721C296.133 32.8363 295.934 32.9184 295.7 32.9184ZM303.695 22.0495V29.1188H305.069V30.2385H303.695V32.7542H302.486V30.2385H297.455V29.1785C297.923 28.651 298.395 28.0886 298.873 27.4915C299.351 26.8893 299.806 26.2797 300.239 25.6626C300.677 25.0455 301.08 24.4308 301.448 23.8187C301.822 23.2016 302.135 22.6119 302.389 22.0495H303.695ZM298.836 29.1188H302.486V23.8784C302.113 24.5304 301.759 25.1126 301.426 25.6252C301.093 26.1378 300.774 26.6031 300.471 27.0212C300.172 27.4392 299.886 27.8174 299.612 28.1558C299.338 28.4942 299.08 28.8152 298.836 29.1188ZM313.176 32.7542H311.459L308.085 29.0815H308.055V32.7542H306.831V21.4374H308.055V28.6112H308.085L311.295 25.1102H312.9L309.354 28.7978L313.176 32.7542Z" />
              <Path d="M346.491 15.2881L352.784 21.4416L351.227 22.9746L347.595 19.412V29.7649H345.386V19.412L341.743 22.9746L340.186 21.4416L346.491 15.2881ZM356.428 28.6854L356.406 32.4746C356.406 33.9644 355.169 35.1627 353.645 35.1627H339.314C337.779 35.1627 336.553 33.9536 336.553 32.4638V28.6854H338.762V32.4638C338.762 32.7661 339.004 33.0036 339.314 33.0036H353.645C353.955 33.0036 354.197 32.7661 354.197 32.4638L354.22 28.6854H356.428Z" />
            </G>
          </Svg>
        </View>
      </View>
    );
  }

  if (style === 'instagram') {
    return (
      <View style={{ ...rootFlex, backgroundColor: cardBg, borderRadius: pad(6), borderWidth: pad(1), borderColor: '#11111112', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(7), paddingHorizontal: pad(12), paddingTop: pad(10) }}>
          <Avatar page={page} pad={pad} size={20} />
          <Text style={{ ...F(font, true), fontSize: pad(9), color: ink }} numberOfLines={1}>{name}</Text>
          {check(9)}
          {watermark ? <Watermark font={font} pad={pad} size={8} color={gray} /> : null}
          <View style={{ flex: 1 }} />
          <SocialGlyph platform="instagram" size={pad(11)} color="#E1306C" />
          <Ionicons name="ellipsis-horizontal" size={pad(12)} color={ink} />
        </View>
        <AutoFit fit={fit} maxH={maxH} style={body(true, true)}>{children}</AutoFit>
        <View style={{ paddingHorizontal: pad(12), paddingBottom: pad(11), gap: pad(6) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(10) }}>
            <ActionIcon name="ig-heart" size={pad(14)} color={ink} />
            <ActionIcon name="ig-comment" size={pad(14)} color={ink} />
            <ActionIcon name="ig-repost" size={pad(17)} color={ink} />
            <ActionIcon name="ig-plane" size={pad(14)} color={ink} />
            <View style={{ flex: 1 }} />
            <ActionIcon name="ig-bookmark" size={pad(14)} color={ink} />
          </View>
          <Text style={{ ...F(font), fontSize: pad(8.5), color: ink }}>
            <Text style={{ ...F(font, true) }}>Liked by you</Text> and 1,234 others
          </Text>
          <Text style={{ ...F(font), fontSize: pad(8.5), color: gray }}>View all 48 comments</Text>
        </View>
      </View>
    );
  }

  if (style === 'threads') {
    return (
      <View style={{ ...rootFlex, backgroundColor: cardBg, borderRadius: pad(14), borderWidth: pad(1), borderColor: hairline, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(7), paddingHorizontal: pad(13), paddingTop: pad(11) }}>
          <Avatar page={page} pad={pad} size={20} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(3), flexShrink: 1, minWidth: 0 }}>
            <Text style={{ ...F(font, true), fontSize: pad(9), color: ink, flexShrink: 1 }} numberOfLines={1}>
              {firstHandle}
            </Text>
            {check(8)}
          </View>
          <Text style={{ ...F(font), fontSize: pad(8), color: faint }}>· 2h</Text>
          {watermark ? <Watermark font={font} pad={pad} size={8} color={faint} /> : null}
          <View style={{ flex: 1 }} />
          {/* Official Threads wordmark — currentColor via the ink color
              prop, theme-aware like the web canvas. */}
          <Svg width={pad(40)} height={pad(8)} viewBox="0 0 1922 375.61" style={{ flexShrink: 0 }}>
            <G fill={ink}>
              <Path d="M267.15,173.74c-.47-54.26-29.88-86.96-79.57-86.96-33.17,0-61.06,15-75.71,38.91l32.11,22.38c8.32-13.13,19.81-24.03,40.9-24.03,23.79,0,36.1,13.24,39.61,37.85-11.49-1.76-22.97-2.7-34.81-2.7-64.22,0-94.46,29.06-94.46,67.5s30.24,62.11,74.77,62.11c48.87,0,78.05-32.93,90.01-73.71,12.42,5.62,20.98,18.75,20.98,38.44,0,52.74-60.82,81.45-112.39,81.45-76.06,0-125.75-49.92-125.75-131.14,0-99.5,65.75-163.25,154.11-163.25,59.3,0,88.6,26.02,108.52,60.94l32.82-22.97C316.61,33.34,268.2,1,195.54,1,79.75,1,1,83.15,1,202.34c0,108.99,77.11,172.28,168.99,172.28,75.94,0,152.71-44.3,152.71-120.12,0-39.61-22.74-65.86-55.55-80.75h0ZM168.59,249.33c-16.76,0-31.52-7.97-31.52-22.62,0-23.09,28.36-30.12,56.14-30.12,10.55,0,20.86.7,30,2.7-6.56,30-26.02,50.04-54.61,50.04h0Z" />
              <Path d="M735.69,97.33c-33.52,0-65.4,18.52-80.98,56.84l20.16-113.68h-56.49l-52.03,294.63h56.6l22.62-128.33c7.97-46.29,33.87-61.06,57.42-61.06s38.09,14.88,38.09,37.03c0,4.22-.7,9.02-1.64,14.06l-24.26,138.29h56.49l28.01-159.38c1.05-5.86,2.11-12.31,2.11-19.34,0-40.2-30.94-59.07-66.1-59.07h0Z" />
              <Path d="M582.64,101.55L517.24,101.55L525.56,53.15L468.96,53.15L460.64,101.55L407.9,101.55L400.28,143.62L453.14,143.62L419.62,335.12L476.22,335.12L509.62,143.62L575.14,143.62L582.64,101.55Z" />
              <Path d="M964.11,97.33c-35.16,0-58.25,28.71-69.97,56.84l9.14-52.62h-56.49l-41.14,233.57h56.6l23.09-131.26c6.8-38.32,26.84-56.84,50.28-56.84,10.9,0,20.51,2.81,29.3,9.02l33.05-48.17c-8.32-6.33-19.92-10.55-33.87-10.55h0Z" />
              <Path d="M1105.32,96.63c-71.96,0-124.46,61.06-124.46,134.66,0,67.15,46.17,107.35,110.98,107.35,31.41,0,63.75-8.44,86.72-31.64l-26.84-38.56c-14.65,14.65-32.11,26.02-55.67,26.02-36.45,0-59.07-24.61-58.71-63.17h155.05c2.93-14.3,4.69-27.77,4.69-40.43,0-56.02-35.39-94.22-91.76-94.22ZM1142.94,193.43h-101.02c8.79-32.46,28.95-54.73,60.71-54.73,26.25,0,41.37,17.11,41.37,42.54,0,3.87-.35,7.97-1.06,12.19h0Z" />
              <Path d="M1874.94,205.85l-37.74-23.2c-11.25-6.68-16.76-12.66-16.76-21.1,0-12.19,10.43-20.98,29.3-20.98,16.76,0,31.99,9.49,44.42,21.33l26.84-38.21c-12.54-14.77-37.85-27.31-71.25-27.31-48.17,0-85.9,25.67-85.9,71.49,0,31.52,16.76,49.22,39.03,62.35l40.55,23.91c8.91,5.62,12.66,10.66,12.66,18.99,0,12.66-12.66,21.1-31.53,21.1-16.29,0-38.79-10.78-52.74-25.43l-26.84,38.09c14.65,18.99,44.06,31.52,79.69,31.52,54.49,0,87.9-27.42,87.9-69.5,0-27.31-11.72-47.11-37.62-63.05h0Z" />
              <Path d="M1414.37,149.72c-5.51-27.89-29.42-53.68-74.18-53.68-69.38,0-119.89,60.94-119.89,137,0,63.4,37.85,105.71,91.3,105.71,28.13,0,43.95-12.77,54.96-25.2l23.67-26.84-8.44,48.4h56.84l41.02-233.57h-56.72l-8.56,48.17h0ZM1334.68,292.23c-30.24,0-55.55-18.99-55.55-63.4,0-40.2,19.92-88.83,68.68-88.83,31.17,0,55.55,19.1,55.55,63.4s-23.56,88.83-68.68,88.83Z" />
              <Path d="M1700.56,40.49l-19.22,109.23c-5.51-27.89-29.42-53.68-74.18-53.68-69.38,0-119.89,60.94-119.89,137,0,63.4,37.85,105.71,91.3,105.71,28.13,0,43.95-12.77,54.96-25.2l23.67-26.84-8.44,48.4h56.84l51.68-294.63h-56.72ZM1601.65,292.23c-30.24,0-55.55-18.99-55.55-63.4,0-40.2,19.92-88.83,68.68-88.83,31.17,0,55.55,19.1,55.55,63.4s-23.56,88.83-68.68,88.83Z" />
            </G>
          </Svg>
        </View>
        <AutoFit fit={fit} maxH={maxH} style={body(true, true)}>{children}</AutoFit>
        <View style={{ paddingHorizontal: pad(13), paddingBottom: pad(11), gap: pad(6) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(11) }}>
            <ActionIcon name="ig-heart" size={pad(14)} color={ink} />
            <ActionIcon name="ig-comment" size={pad(14)} color={ink} />
            <ActionIcon name="th-repost" size={pad(14)} color={ink} />
            <ActionIcon name="th-send" size={pad(14)} color={ink} />
          </View>
          <Text style={{ ...F(font), fontSize: pad(8), color: faint }}>12 replies</Text>
        </View>
      </View>
    );
  }

  if (style === 'bluesky') {
    return (
      <View style={{ ...rootFlex, backgroundColor: cardBg, borderRadius: pad(14), borderWidth: pad(1), borderColor: hairline, overflow: 'hidden' }}>
        {/* author header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: pad(7), paddingHorizontal: pad(13), paddingTop: pad(11) }}>
          <Avatar page={page} pad={pad} size={22} />
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: pad(4) }}>
              <Text style={{ ...F(font, true), fontSize: pad(9), color: ink, flexShrink: 1 }} numberOfLines={1}>{name} {check(9)}</Text>
              {watermark ? <Watermark font={font} pad={pad} size={8} color={gray} /> : null}
            </View>
            <Text style={{ ...F(font), fontSize: pad(8), color: gray }} numberOfLines={1}>{firstHandle} · 2h</Text>
          </View>
        </View>
        <AutoFit fit={fit} maxH={maxH} style={body(true, true)}>{children}</AutoFit>
        {/* reply · repost · like · save · share · more — like the app */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad(14), paddingBottom: pad(10), gap: pad(4) }}>
          {[
            { custom: 'bsky-comment' as const, count: '12', color: gray },
            { custom: 'bsky-repost' as const, count: '48', color: '#2E9E53' },
            { custom: 'bsky-heart' as const, count: '312', color: '#EC245E' },
            { custom: 'bsky-bookmark' as const, count: '', color: gray },
            { custom: 'bsky-share' as const, count: '', color: gray },
            { icon: 'ellipsis-horizontal', count: '', color: gray },
          ].map((a, i) => (
            <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              {'custom' in a && a.custom ? (
                <ActionIcon name={a.custom} size={pad(14)} color={a.color} />
              ) : (
                <Ionicons name={(a as { icon: string }).icon as any} size={pad(14)} color={a.color} />
              )}
              {a.count ? <Text style={{ ...F(font), fontSize: pad(8), color: gray }}>{a.count}</Text> : null}
            </View>
          ))}
        </View>
      </View>
    );
  }

  // minimal
  return (
    <View style={{ flex: fit ? undefined : 1, flexShrink: fit ? 1 : 0 }}>
      <AutoFit fit={fit} maxH={maxH} style={{ flex: 1, gap: pad(10), backgroundColor: cardBg, borderRadius: pad(14), padding: pad(13), borderWidth: pad(1), borderColor: '#11111112' }}>
        {children}
      </AutoFit>
      {watermark ? (
        <View style={{ position: 'absolute', right: pad(13), bottom: pad(13) }}>
          <Watermark font={font} pad={pad} size={8} color={gray} />
        </View>
      ) : null}
    </View>
  );
}
