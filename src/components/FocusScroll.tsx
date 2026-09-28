import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { Dimensions, Keyboard, ScrollView, TextInput } from 'react-native';

/**
 * Scroll-a-textbox-into-view, without native deps. Screens that own a
 * ScrollView full of inputs mount `useFocusScrollPanel`, hand its refs to
 * the ScrollView, and expose `ensureVisible` through `FocusScrollBridge` —
 * `Txt` calls it on focus, so the typed box always lands above the keyboard.
 *
 * Why not the keyboard-aware-scroll-view lib: it silently mis-measures on
 * Fabric (nothing scrolls), and it fought the outer KeyboardAvoidingView.
 * This measures the real input + panel rects and scrolls the exact delta.
 */

const Ctx = createContext<{ ensureVisible: (input: TextInput | null) => void }>({
  ensureVisible: () => {},
});

export function FocusScrollBridge({ ensureVisible, children }: {
  ensureVisible: (input: TextInput | null) => void;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ ensureVisible }}>{children}</Ctx.Provider>;
}

export function useFocusScrollContext() {
  return useContext(Ctx);
}

export function useFocusScrollPanel(extra = 16) {
  type Measurable = {
    measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  };
  const scrollRef = useRef<ScrollView & Measurable>(null);
  const kbH = useRef(0);
  const scrollY = useRef(0);
  const lastInput = useRef<TextInput | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      kbH.current = e.endCoordinates.height;
      // The focused box may have been measured before the keyboard reported
      // — re-run once the true height is known.
      const input = lastInput.current;
      if (input) ensureVisible(input);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      kbH.current = 0;
      lastInput.current = null;
    });
    return () => {
      show.remove();
      hide.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureVisible = useCallback(
    (input: TextInput | null) => {
      if (!input || !scrollRef.current) return;
      lastInput.current = input;
      // onFocus fires before the keyboard reports — retry until it does.
      let attempts = 0;
      const attempt = () => {
        attempts += 1;
        if (kbH.current === 0 && attempts < 8) {
          setTimeout(attempt, 60);
          return;
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const scroll = scrollRef.current;
            if (!scroll) return;
            scroll.measureInWindow((_sx, sy, _sw, sh) => {
              input.measureInWindow((_ix, iy, _iw, ih) => {
                const screenH = Dimensions.get('window').height;
                const visibleBottom = Math.min(screenH - kbH.current, sy + sh) - extra;
                const bottom = iy + ih;
                if (bottom > visibleBottom) {
                  scroll.scrollTo({ y: Math.max(0, scrollY.current + (bottom - visibleBottom)), animated: true });
                } else if (iy < sy + 4) {
                  scroll.scrollTo({ y: Math.max(0, scrollY.current - (sy + 4 - iy)), animated: true });
                }
              });
            });
          });
        });
      };
      attempt();
    },
    [extra],
  );

  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { scrollRef, scrollY, ensureVisible, onScroll };
}
