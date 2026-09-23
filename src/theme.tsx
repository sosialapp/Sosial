import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Sosial — brand trio: bolt yellow on black and white.
 * App chrome type: Space Grotesk display + Inter UI. NOTE: custom families
 * must never be paired with fontWeight (iOS drops the font) — use the Bold
 * family files instead.
 *
 * Colors are dynamic: consume via useTheme(), never import C directly.
 * Every module-scope StyleSheet must be a makeS(C) factory called per render. */

export type ThemeMode = 'light' | 'dark';

export interface Palette {
  ink: string;
  soft: string;
  muted: string;
  faint: string;
  paper: string;
  bone: string;
  surface: string;
  card: string;
  line: string;
  lineSoft: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  /** text/icons sitting on ink or accent fills */
  onInk: string;
  paleYellow: string;
  yellowText: string;
  paleBlue: string;
  blueText: string;
  paleGreen: string;
  greenText: string;
  paleRed: string;
  redText: string;
}

export const LIGHT: Palette = {
  ink: '#1C1A14',
  soft: '#33302A',
  muted: '#6B675F',
  faint: '#9A958B',
  paper: '#FFFFFF',
  bone: '#FFFFFF',
  surface: '#F4F4F4',
  card: '#FFFFFF',
  line: '#E2E2E2',
  lineSoft: '#EFEFEF',
  accent: '#FFC62E',
  accentInk: '#1C1A14',
  accentSoft: '#FDF3D7',
  onInk: '#FFFFFF',
  paleYellow: '#FDF3D7',
  yellowText: '#1C1A14',
  paleBlue: '#E1F3FE',
  blueText: '#1F6C9F',
  paleGreen: '#EDF3EC',
  greenText: '#346538',
  paleRed: '#FDEBEC',
  redText: '#9F2F2D',
};

export const DARK: Palette = {
  ink: '#FFFFFF',
  soft: '#D4D4D4',
  muted: '#A3A3A3',
  faint: '#737373',
  paper: '#000000',
  bone: '#000000',
  surface: '#1A1A1A',
  card: '#101010',
  line: '#2A2A2A',
  lineSoft: '#1F1F1F',
  accent: '#FFC62E',
  accentInk: '#FFC62E',
  accentSoft: '#2A230A',
  onInk: '#000000',
  paleYellow: '#2A230A',
  yellowText: '#FFD84A',
  paleBlue: '#14303F',
  blueText: '#8FD0F5',
  paleGreen: '#1C3325',
  greenText: '#9BD8A6',
  paleRed: '#3D1D1E',
  redText: '#F2A3A3',
};

const THEME_KEY = 'zap_theme_v1';

interface ThemeCtx {
  C: Palette;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ C: DARK, mode: 'dark', setMode: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'dark' || v === 'light') setModeState(v);
    }).catch(() => {});
  }, []);
  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(THEME_KEY, m).catch(() => {});
  };
  const toggle = () => setMode(mode === 'light' ? 'dark' : 'light');
  return <Ctx.Provider value={{ C: mode === 'light' ? LIGHT : DARK, mode, setMode, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}

export const R = { sm: 10, md: 14, lg: 20, xl: 28 };

export const T = {
  display: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 38, letterSpacing: -1.5, lineHeight: 46 },
  h1: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 25, letterSpacing: -0.6, lineHeight: 32 },
  h2: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, letterSpacing: -0.2, lineHeight: 22 },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21 },
  small: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 18 },
  micro: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, lineHeight: 16 },
  /** eyebrow kicker — the ONLY all-caps style, for screen headers */
  tag: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, letterSpacing: 1.8 },
};

/** Muted editorial data palette (charts) — bolt-led trio scale */
export const DATA = ['#FFC62E', '#8A8A8A', '#3A3A3A', '#C9A227', '#6E6E6E', '#1C1A14', '#E8D48B', '#4A4A4A', '#A8842C', '#B5B5B5', '#5C5C5C', '#F2A400'];
