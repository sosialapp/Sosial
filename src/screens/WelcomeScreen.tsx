import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, T, R, Palette } from '../theme';
import { PrimaryBtn, GhostBtn, Txt, GoogleGlyph } from '../components/ui';
import { TERMS_TEXT, PRIVACY_SECTIONS } from '../utils/legal';
import {
  isSupabaseConfigured,
  signInEmail,
  signUpEmail,
  signInWithGoogle,
  pullProfileFromCloud,
} from '../utils/supabase';

export interface WelcomeProfile {
  email: string;
  team: string;
  notifPosts: boolean;
  notifComments: boolean;
  notifWeekly: boolean;
}

/**
 * First-run landing: brand moment plus sign in / create account.
 * Successful auth pulls the cloud profile (cloud wins) and hands it up
 * so Shell can mirror AccountScreen's post-login state.
 */
export default function WelcomeScreen({
  onDone,
  onSkip,
  allowSkip = true,
}: {
  onDone: (profile: WelcomeProfile) => void;
  onSkip: () => void;
  /** False after an explicit sign-out: the user must sign back in. */
  allowSkip?: boolean;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [legal, setLegal] = useState<null | 'terms' | 'privacy'>(null);

  const finish = async (fallbackEmail: string) => {
    let profile: WelcomeProfile = {
      email: fallbackEmail.trim(),
      team: 'My team',
      notifPosts: true,
      notifComments: true,
      notifWeekly: false,
    };
    try {
      const prof = await pullProfileFromCloud();
      if (prof) {
        profile = {
          email: prof.email,
          team: prof.team,
          notifPosts: prof.notifPosts,
          notifComments: prof.notifComments,
          notifWeekly: prof.notifWeekly,
        };
      }
    } catch {}
    onDone(profile);
  };

  const doSubmit = async () => {
    if (!email.trim() || pw.length < 6) {
      setErr('Enter an email and a password (min 6 characters).');
      return;
    }
    if (mode === 'up' && pw !== pw2) {
      setErr('Passwords don’t match — retype them.');
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      if (mode === 'up') {
        const r = await signUpEmail(email, pw);
        if (r.needsConfirm) {
          setNotice('Account created — check your inbox for the confirmation link, then sign in.');
          setPw('');
          setPw2('');
          setMode('in');
          return;
        }
      } else {
        await signInEmail(email, pw);
      }
      setPw('');
      setPw2('');
      await finish(email);
    } catch (e: any) {
      setErr(e?.message ?? (mode === 'up' ? 'Sign-up failed.' : 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  const doGoogle = async () => {
    // Same platform limit as AccountScreen: Expo Go cannot receive the
    // https OAuth return; dev builds use the sosial:// scheme and work.
    if (Constants.appOwnership === 'expo') {
      Alert.alert(
        'Needs a development build',
        'Google sign-in can’t return to Expo Go. Use email + password here — Google lights up automatically in dev builds.',
      );
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      await signInWithGoogle();
      setPw('');
      await finish(email);
    } catch (e: any) {
      setErr(e?.message ?? 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: C.bone }}
    >
      <ScrollView
        contentContainerStyle={s.wrap}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={require('../../assets/bolt.png')} style={{ width: 68, height: 88, marginBottom: 10 }} resizeMode="contain" />
        <Text style={s.title}>Sosial</Text>
        <Text style={s.sub}>Every channel. One calendar.</Text>
        <Text style={s.strip}>Compose · Schedule · Published</Text>

        <View style={s.card}>
          {!configured ? (
            <>
              <Text style={s.note}>
                Backend not configured — add the Supabase keys to .env and restart Expo to enable
                accounts.
              </Text>
              {allowSkip ? (
                <GhostBtn label="Explore without an account" onPress={onSkip} />
              ) : null}
            </>
          ) : (
            <>
              <View style={s.seg}>
                {(['up', 'in'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => {
                      setMode(m);
                      setPw2('');
                      setErr(null);
                      setNotice(null);
                    }}
                    style={[s.segBtn, mode === m && s.segBtnOn]}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.segT, mode === m && s.segTOn]}>
                      {m === 'up' ? 'Create account' : 'Sign in'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Txt
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setErr(null);
                }}
                placeholder="Email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
              />
              <PwField
                value={pw}
                onChangeText={(v) => {
                  setPw(v);
                  setErr(null);
                }}
                placeholder="Password (min 6 chars)"
                show={showPw}
                onToggleShow={() => setShowPw((v) => !v)}
                eyeColor={C.faint}
                returnKeyType={mode === 'up' ? 'next' : 'done'}
                onSubmitEditing={() => {
                  if (!busy) void doSubmit();
                }}
              />
              {mode === 'up' ? (
                <PwField
                  value={pw2}
                  onChangeText={(v) => {
                    setPw2(v);
                    setErr(null);
                  }}
                  placeholder="Repeat password"
                  show={showPw}
                  onToggleShow={() => setShowPw((v) => !v)}
                  eyeColor={C.faint}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (!busy) void doSubmit();
                  }}
                />
              ) : null}
              {err ? <Text style={s.err}>{err}</Text> : null}
              {notice ? <Text style={s.note}>{notice}</Text> : null}
              <PrimaryBtn
                label={mode === 'up' ? 'Create account' : 'Sign in'}
                loading={busy}
                loadingLabel="Working…"
                onPress={() => {
                  if (!busy) void doSubmit();
                }}
              />
              <GhostBtn
                label="Continue with Google"
                left={<GoogleGlyph size={16} />}
                onPress={() => {
                  if (!busy) void doGoogle();
                }}
              />
              {mode === 'up' ? (
                <Text style={s.fine}>
                  By signing up, you agree to our{' '}
                  <Text style={s.link} onPress={() => setLegal('terms')}>Terms of Use</Text>
                  {' '}and{' '}
                  <Text style={s.link} onPress={() => setLegal('privacy')}>Privacy Policy</Text>.
                </Text>
              ) : null}
              {allowSkip ? (
                <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={s.skipHit}>
                  <Text style={s.skip}>Explore without an account</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
      <Modal visible={legal !== null} transparent animationType="slide" onRequestClose={() => setLegal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.sheetBg}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setLegal(null)} />
            <View style={s.sheet}>
              <ScrollView
                style={{ flexShrink: 1 }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
              >
                <Text style={s.sheetT}>{legal === 'terms' ? 'Terms of Use' : 'Privacy Policy'}</Text>
                {legal === 'terms' ? (
                  <Text style={s.sheetB}>{TERMS_TEXT}</Text>
                ) : (
                  <View style={{ gap: 14 }}>
                    {PRIVACY_SECTIONS.map((sec) => (
                      <View key={sec.title}>
                        <Text style={s.secT}>{sec.title}</Text>
                        <Text style={s.sheetB}>{sec.body}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
              <View style={{ paddingTop: 12 }}>
                <GhostBtn label="Close" onPress={() => setLegal(null)} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/**
 * Password input with a show/hide eye. Module-level (not inline) so the
 * TextInput never remounts and keeps focus while typing.
 */
function PwField({
  value,
  onChangeText,
  placeholder,
  show,
  onToggleShow,
  eyeColor,
  returnKeyType,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  show: boolean;
  onToggleShow: () => void;
  eyeColor: string;
  returnKeyType: 'next' | 'done';
  onSubmitEditing: () => void;
}) {
  return (
    <View>
      <Txt
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={{ paddingRight: 44 }}
      />
      <TouchableOpacity
        onPress={onToggleShow}
        activeOpacity={0.7}
        accessibilityLabel={show ? 'Hide password' : 'Show password'}
        style={pwEye}
      >
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={eyeColor} />
      </TouchableOpacity>
    </View>
  );
}

const pwEye = {
  position: 'absolute',
  right: 12,
  top: 0,
  bottom: 0,
  justifyContent: 'center',
} as const;

const makeS = (C: Palette) =>
  StyleSheet.create({
    wrap: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 40,
      gap: 6,
    },

    title: { ...(T.display as object), color: C.ink } as any,
    sub: { ...(T.body as object), color: C.muted, textAlign: 'center' } as any,
    strip: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 10.5,
      letterSpacing: 1.8,
      color: C.faint,
      marginTop: 6,
      marginBottom: 14,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: C.card,
      borderColor: C.line,
      borderWidth: 1,
      borderRadius: R.lg,
      padding: 18,
      gap: 10,
    },
    seg: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.md, padding: 3, gap: 2 },
    segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.sm },
    segBtnOn: { backgroundColor: C.paper },
    segT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
    segTOn: { color: C.ink },
    err: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: C.redText },
    note: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 18, color: C.muted },
    fine: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 11.5,
      color: C.faint,
      textAlign: 'center',
    },
    link: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 11.5,
      color: C.ink,
      textDecorationLine: 'underline',
    },
    sheetBg: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
    sheet: { backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, maxHeight: '88%' },
    sheetT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, letterSpacing: -0.3, color: C.ink },
    sheetB: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, color: C.soft },
    secT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, letterSpacing: -0.2, color: C.ink, marginBottom: 4 },
    skipHit: { paddingVertical: 6, alignItems: 'center' },
    skip: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 12.5,
      color: C.soft,
      textDecorationLine: 'underline',
    },
  });
