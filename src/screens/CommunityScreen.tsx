import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette, T } from '../theme';
import { SocialGlyph } from '../components/ui';
import NotificationBell from '../components/NotificationBell';
import ChannelDrawer, { DrawerChannel } from '../components/ChannelDrawer';
import { Tabs } from '../components/ui-kit';
import { SOCIAL_META } from '../constants';
import { supabase } from '../utils/supabase';
import {
  CommunityComment,
  CommunityConversation,
  CommunityMessage,
  fetchCommunityComments,
  fetchCommentPosts,
  loadSeen,
  saveSeen,
  CommunityCommentPost,
  fetchCommunityConversations,
  fetchCommunityThread,
  fetchCommunityUnseen,
  markCommunitySeen,
  refreshCommunityInbox,
  replyToCommunityComment,
  sendCommunityMessage,
} from '../utils/community';

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!ts || Number.isNaN(ts)) return '';
  const d = Date.now() - ts;
  if (d < 0) return '';
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** Chat separator: Today, Yesterday, weekday this week, else the date. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  try {
    return d.toLocaleDateString('en-US', days < 7 ? { weekday: 'long' } : { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function providerLabel(provider: string): string {
  return SOCIAL_META[provider]?.label ?? provider;
}

function Face({ name, avatar, size = 34 }: { name: string | null; avatar: string | null; size?: number }) {
  const { C } = useTheme();
  const letter = (name ?? '').trim().replace('@', '').charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.bone,
        borderWidth: 1,
        borderColor: C.lineSoft,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {avatar ? (
        <Image source={{ uri: avatar }} style={{ width: size, height: size }} />
      ) : letter ? (
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: Math.round(size * 0.4), color: C.soft }}>{letter}</Text>
      ) : (
        <Ionicons name="chatbubble-outline" size={Math.round(size * 0.45)} color={C.faint} />
      )}
    </View>
  );
}

/** Community: unified comments + direct messages across connected channels.
 *  `bare` embeds the inbox inside another page (no masthead, no own scroll). */
export default function CommunityScreen({ onConnect, bare }: { onConnect: () => void; bare?: boolean }) {
  const { C } = useTheme();
  const s = makeS(C);
  const [segment, setSegment] = useState<'comments' | 'messages'>('comments');
  const [unseen, setUnseen] = useState({ comments: 0, messages: 0 });
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [convs, setConvs] = useState<CommunityConversation[]>([]);
  const [channels, setChannels] = useState<(DrawerChannel & { provider: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [channel, setChannel] = useState('all');
  const [drawer, setDrawer] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  /** Open post (group key) and the posts' captions/thumbnails. */
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [postCtx, setPostCtx] = useState<Record<string, CommunityCommentPost>>({});
  const postScroll = useRef<ScrollViewInstance>(null);
  const [seenC, setSeenC] = useState<Record<string, string>>({});
  const [seenM, setSeenM] = useState<Record<string, string>>({});
  useEffect(() => {
    void loadSeen('comments').then(setSeenC);
    void loadSeen('messages').then(setSeenM);
  }, []);
  /** Opening a post or chat marks it read up to its newest item. */
  const markSeen = (section: 'comments' | 'messages', key: string, at: string) => {
    const setter = section === 'comments' ? setSeenC : setSeenM;
    setter((prev) => {
      if (prev[key] && prev[key] >= at) return prev;
      const next = { ...prev, [key]: at };
      void saveSeen(section, next);
      return next;
    });
  };
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [openConv, setOpenConv] = useState<CommunityConversation | null>(null);
  const [thread, setThread] = useState<CommunityMessage[] | null>(null);
  const [msgDraft, setMsgDraft] = useState('');
  const [kbOpen, setKbOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const threadScroll = useRef<ScrollViewInstance>(null);

  // With the keyboard up the home indicator is covered, so the composer drops
  // its bottom inset and sits flush on the keys.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const loadChannels = useCallback(async () => {
    const { data } = await supabase()
      .from('connected_channels')
      .select('id,provider,display_name,handle,status')
      .order('created_at', { ascending: true });
    const rows = (data ?? []) as any[];
    setChannels(
      rows
        .filter((r) => String(r.status ?? '') !== 'revoked')
        .map((r) => ({
          id: String(r.id),
          label: r.display_name || providerLabel(String(r.provider)),
          sub: `@${String(r.handle ?? r.provider).replace(/^@/, '')}`,
          connected: true,
          provider: String(r.provider),
        })),
    );
  }, []);

  const loadAll = useCallback(async () => {
    setErr(null);
    try {
      const [cs, cv] = await Promise.all([fetchCommunityComments(), fetchCommunityConversations()]);
      setComments(cs);
      setConvs(cv);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load the inbox.');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadChannels();
      await loadAll();
      setUnseen(await fetchCommunityUnseen());
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening a segment clears its badge.
  useEffect(() => {
    void markCommunitySeen(segment).then(async () => setUnseen(await fetchCommunityUnseen()));
  }, [segment]);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setErr(null);
    try {
      await refreshCommunityInbox();
      await new Promise((r) => setTimeout(r, 8000));
      await loadAll();
      if (openConv) setThread(await fetchCommunityThread(openConv.id));
      setUnseen(await fetchCommunityUnseen());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the refresh.');
    } finally {
      setRefreshing(false);
    }
  };

  const postPairKey = [...new Set(comments.filter((c) => c.external_post_id).map((c) => `${c.channel_id}:${c.external_post_id}`))]
    .sort()
    .join('|');
  useEffect(() => {
    if (!postPairKey) return;
    const pairs = postPairKey.split('|').map((k) => {
      const at = k.indexOf(':');
      return { channel: k.slice(0, at), external: k.slice(at + 1) };
    });
    void fetchCommentPosts(pairs).then(setPostCtx).catch(() => {});
  }, [postPairKey]);

  const sendCommentReply = async (c: CommunityComment) => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await replyToCommunityComment(c.id, text);
      setDraft('');
      setReplyFor(null);
      // The worker posts on the platform first, then stores our reply as an
      // is_own row; keep watching the thread until that row lands.
      const seen = new Set(
        comments.filter((r) => r.is_own && r.parent_external_id === c.external_id).map((r) => r.id),
      );
      let landed = false;
      for (let i = 0; i < 24 && !landed; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const next = await fetchCommunityComments();
        setComments(next);
        landed =
          next.some((r) => r.is_own && r.parent_external_id === c.external_id && !seen.has(r.id)) ||
          next.some((r) => r.id === c.id && r.status === 'replied');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the reply.');
    } finally {
      setBusy(false);
    }
  };

  const openThread = async (c: CommunityConversation) => {
    markSeen('messages', c.id, c.last_message_at ?? new Date().toISOString());
    setOpenConv(c);
    setThread(null);
    setErr(null);
    try {
      setThread(await fetchCommunityThread(c.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load the conversation.');
    }
  };

  const sendDm = async () => {
    const text = msgDraft.trim();
    if (!text || !openConv || busy) return;
    setBusy(true);
    setErr(null);
    const pending: CommunityMessage = {
      id: `local:${Date.now()}`,
      conversation_id: openConv.id,
      direction: 'out',
      body: text,
      sent_at: new Date().toISOString(),
      status: 'pending',
    };
    setThread((t) => [...(t ?? []), pending]);
    setMsgDraft('');
    try {
      const refusal = await sendCommunityMessage(openConv.id, text);
      if (refusal) throw new Error(refusal);
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        setThread(await fetchCommunityThread(openConv.id));
      }
      setConvs(await fetchCommunityConversations());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the message.');
    } finally {
      setBusy(false);
    }
  };

  const shownComments = comments.filter((c) => channel === 'all' || c.channel_id === channel);
  const providerOf = (id: string) => channels.find((c) => c.id === id)?.provider ?? 'x';
  const channelLabel = channel === 'all' ? 'All channels' : channels.find((c) => c.id === channel)?.label ?? 'Channel';

  /** Comments bucketed by the post they were left on: one topic per post. */
  const groups = (() => {
    const by = new Map<string, { key: string; channelId: string; platform: string; postId: string | null; list: CommunityComment[] }>();
    for (const c of shownComments) {
      const key = `${c.channel_id}:${c.external_post_id ?? '-'}`;
      const g = by.get(key) ?? { key, channelId: c.channel_id, platform: c.platform, postId: c.external_post_id, list: [] };
      g.list.push(c);
      by.set(key, g);
    }
    return [...by.values()]
      .map((g) => {
        const list = [...g.list].sort((x, y) => x.created_at.localeCompare(y.created_at));
        const answered = new Set(list.filter((c) => c.is_own && c.parent_external_id).map((c) => c.parent_external_id));
        const open = list.filter((c) => !c.is_own && c.status !== 'replied' && !answered.has(c.external_id));
        const seen = new Set<string>();
        const people = [...list].reverse().filter((c) => {
          if (c.is_own) return false;
          const who = c.author_name ?? c.id;
          if (seen.has(who)) return false;
          seen.add(who);
          return true;
        });
        return {
          ...g,
          list,
          open,
          answered,
          people,
          unread: list.filter((c) =>
            !c.is_own && (seenC[g.key] ? c.created_at > seenC[g.key] : c.status === 'new'),
          ).length,
          last: list[list.length - 1]?.created_at ?? '',
          post: g.postId ? postCtx[`${g.channelId}:${g.postId}`] : undefined,
        };
      })
      .sort((x, y) => y.last.localeCompare(x.last));
  })();
  const current = openPost ? groups.find((g) => g.key === openPost) : undefined;

  /** One post as a topic card: its caption, who is talking, what needs an answer. */
  const postCard = (g: (typeof groups)[number]) => {
    const meta = SOCIAL_META[g.platform];
    const latest = g.list[g.list.length - 1];
    const others = g.list.filter((c) => !c.is_own).length;
    const caption = (g.post?.body ?? '').trim();
    return (
      <TouchableOpacity
        key={g.key}
        onPress={() => {
          setOpenPost(g.key);
          if (g.last) markSeen('comments', g.key, g.last);
          setReplyFor(null);
          setDraft('');
        }}
        style={s.postCard}
        activeOpacity={0.8}
      >
        <View>
          {g.post?.thumbnail ? (
            <Image source={{ uri: g.post.thumbnail }} style={s.postThumb} />
          ) : (
            <View style={[s.postThumb, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="document-text-outline" size={20} color={C.faint} />
            </View>
          )}
          <View style={[s.postBadge, { backgroundColor: meta?.bg ?? C.ink }]}>
            <SocialGlyph platform={g.platform} size={9} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[s.postTitle, g.unread > 0 && { fontFamily: 'PlusJakartaSans_800ExtraBold' }]} numberOfLines={1}>
              {caption || `${meta?.label ?? g.platform} post`}
            </Text>
            <Text style={s.commentT}>{latest ? timeAgo(latest.created_at) : ''}</Text>
          </View>
          {latest ? (
            <Text style={s.postLatest} numberOfLines={1}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{latest.is_own ? 'You' : latest.author_name || 'Someone'}: </Text>
              {latest.body}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <View style={{ flexDirection: 'row' }}>
              {g.people.slice(0, 4).map((p, i) => (
                <View key={p.id} style={{ marginLeft: i ? -7 : 0, borderRadius: 11, borderWidth: 2, borderColor: C.card }}>
                  <Face name={p.author_name} avatar={p.author_avatar} size={20} />
                </View>
              ))}
            </View>
            <Text style={s.commentT}>{others} comment{others === 1 ? '' : 's'}</Text>
            <View style={{ flex: 1 }} />
            {g.unread > 0 ? (
              <View style={[s.sentPill, { backgroundColor: C.accent }]}>
                <Text style={[s.sentPillT, { color: '#0b1220' }]}>{g.unread} new</Text>
              </View>
            ) : g.open.length > 0 ? (
              <View style={[s.sentPill, { backgroundColor: C.surface }]}>
                <Text style={[s.sentPillT, { color: C.muted }]}>{g.open.length} to answer</Text>
              </View>
            ) : others > 0 ? (
              <Text style={[s.commentT, { color: C.greenText }]}>✓ All answered</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const content = (
    <>
      {bare ? null : (
        <View style={s.masthead}>
          <View>
            <Text style={[T.h1, { color: C.ink, fontSize: 30, lineHeight: 36 }]}>Community</Text>
            <Text style={s.sub}>Comments and messages, in one place.</Text>
          </View>
          <NotificationBell />
        </View>
      )}

      <View style={{ paddingHorizontal: 24, marginTop: bare ? 0 : 14 }}>
        <Tabs
          options={[
            { value: 'comments', label: 'Comments' },
            { value: 'messages', label: 'Messages' },
          ]}
          value={segment}
          onChange={setSegment}
          accessibilityLabel="Community sections"
          renderOption={(o, active) => {
            const count = unseen[o.value as 'comments' | 'messages'] ?? 0;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={[active ? s.tabOnT : s.tabT, { color: active ? C.ink : C.muted }]}>{o.label}</Text>
                {count > 0 ? (
                  <View
                    style={{
                      minWidth: 17,
                      paddingHorizontal: 4,
                      height: 17,
                      borderRadius: 9,
                      backgroundColor: C.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 9.5, color: '#0b1220' }}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity onPress={() => setDrawer(true)} style={[s.chanBtn, { flex: 1 }]} activeOpacity={0.75}>
          {channel === 'all' ? (
            <Ionicons name="globe" size={18} color={C.accentInk} />
          ) : (
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: SOCIAL_META[providerOf(channel)]?.bg ?? C.ink, alignItems: 'center', justifyContent: 'center' }}>
              <SocialGlyph platform={providerOf(channel)} size={14} color="#fff" />
            </View>
          )}
          <Text style={s.chanBtnT} numberOfLines={1}>{channelLabel}</Text>
          <Ionicons name="chevron-down" size={18} color={C.faint} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void onRefresh()} style={s.iconBtn} activeOpacity={0.75} disabled={refreshing}>
          {refreshing ? <ActivityIndicator size="small" color={C.muted} /> : <Ionicons name="refresh" size={15} color={C.muted} />}
        </TouchableOpacity>
      </View>

      {err ? (
        <View style={{ paddingHorizontal: 24, marginTop: 10 }}>
          <Text style={s.err}>{err}</Text>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 24, marginTop: 14 }}>
        {loading ? (
          <View style={s.empty}>
            <ActivityIndicator size="small" color={C.accent} />
            <Text style={s.emptyS}>Loading inbox…</Text>
          </View>
        ) : segment === 'comments' ? (
          shownComments.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="chatbubbles" size={20} color={C.faint} />
              </View>
              <Text style={s.emptyT}>No comments yet</Text>
              <Text style={s.emptyS}>Comments on your posts land here when the engine sweeps, every 5 minutes or on Refresh.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>{groups.map(postCard)}</View>
          )
        ) : convs.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="mail-unread-outline" size={20} color={C.faint} />
            </View>
            <Text style={s.emptyT}>No messages yet</Text>
            <Text style={s.emptyS}>Direct messages from connected channels arrive here when the engine sweeps.</Text>
          </View>
        ) : (
          <View style={s.feed}>
            {convs.map((c) => {
              const meta = SOCIAL_META[c.platform];
              return (
                <TouchableOpacity key={c.id} style={s.convRow} onPress={() => void openThread(c)} activeOpacity={0.7}>
                  <Face name={c.participant_name} avatar={c.participant_avatar} size={38} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.convName} numberOfLines={1}>{c.participant_name || 'Conversation'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={[s.miniLogo, { backgroundColor: meta?.bg ?? C.ink }]}>
                        <SocialGlyph platform={c.platform} size={8} color="#fff" />
                      </View>
                      <Text style={s.commentT} numberOfLines={1}>
                        {meta?.label ?? c.platform}
                        {c.last_message_at ? ` · ${timeAgo(c.last_message_at)}` : ''}
                      </Text>
                    </View>
                  </View>
                  {(seenM[c.id] ? !!c.last_message_at && c.last_message_at > seenM[c.id] : c.unread_count > 0) ? (
                    <View style={s.unreadDot} />
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={C.faint} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </>
  );

  const target = current
    ? (replyFor ? current.list.find((c) => c.id === replyFor) : undefined) ??
      current.open[current.open.length - 1] ??
      [...current.list].reverse().find((c) => !c.is_own)
    : undefined;
  const byExternal = new Map((current?.list ?? []).map((c) => [c.external_id, c]));

  const postModal = (
    <Modal
      visible={!!current}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => setOpenPost(null)}
    >
      <View style={{ flex: 1, backgroundColor: C.bone, paddingTop: insets.top }}>
        <View style={s.threadHead}>
          <TouchableOpacity onPress={() => setOpenPost(null)} style={s.headBtn} activeOpacity={0.7} accessibilityLabel="Back to posts">
            <Ionicons name="chevron-back" size={24} color={C.ink} />
          </TouchableOpacity>
          {current?.post?.thumbnail ? (
            <Image source={{ uri: current.post.thumbnail }} style={{ width: 36, height: 36, borderRadius: 10 }} />
          ) : (
            <View style={[s.faceWrap, { width: 36, height: 36, borderRadius: 10, backgroundColor: SOCIAL_META[current?.platform ?? '']?.bg ?? C.ink }]}>
              <SocialGlyph platform={current?.platform ?? 'x'} size={16} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.commentT} numberOfLines={1}>
              {providerLabel(current?.platform ?? '')} post · {current ? current.list.filter((c) => !c.is_own).length : 0} comments
            </Text>
            <Text style={s.threadName} numberOfLines={1}>
              {(current?.post?.body ?? '').trim() || `${providerLabel(current?.platform ?? '')} post`}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            ref={postScroll}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => postScroll.current?.scrollToEnd({ animated: false })}
          >
            {(current?.list ?? []).map((c, i, all) => {
              const prev = all[i - 1];
              const newDay = !prev || dayKey(prev.created_at) !== dayKey(c.created_at);
              const parent = c.parent_external_id ? byExternal.get(c.parent_external_id) : undefined;
              const isTarget = target?.id === c.id;
              const done = !c.is_own && (c.status === 'replied' || !!current?.answered.has(c.external_id));
              return (
                <View key={c.id}>
                  {newDay ? (
                    <View style={s.dayRow}>
                      <View style={s.dayLine} />
                      <Text style={s.dayT}>{dayLabel(c.created_at)}</Text>
                      <View style={s.dayLine} />
                    </View>
                  ) : null}
                  {c.is_own ? (
                    <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
                      {parent && !parent.is_own ? (
                        <Text style={[s.commentT, { marginBottom: 3, maxWidth: '80%' }]} numberOfLines={1}>
                          ↳ to {parent.author_name || 'comment'}: {parent.body}
                        </Text>
                      ) : null}
                      <View style={[s.bubble, { backgroundColor: C.accent, borderBottomRightRadius: 6 }]}>
                        <Text style={[s.bubbleT, { color: '#0b1220' }]}>{c.body}</Text>
                      </View>
                      <Text style={[s.bubbleTime, { color: C.faint }]}>You · {timeAgo(c.created_at)}</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 10 }}>
                      <Face name={c.author_name} avatar={c.author_avatar} size={28} />
                      <View style={{ maxWidth: '80%' }}>
                        <View
                          style={[
                            s.bubble,
                            { maxWidth: '100%', backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft, borderBottomLeftRadius: 6 },
                          ]}
                        >
                          <Text style={s.author} numberOfLines={1}>{c.author_name || 'Unknown'}</Text>
                          {parent ? (
                            <Text style={s.commentT} numberOfLines={1}>↳ {parent.is_own ? 'to you' : `to ${parent.author_name || 'a comment'}`}</Text>
                          ) : null}
                          <Text style={[s.bubbleT, { color: C.ink, marginTop: 2 }]}>{c.body || '(empty comment)'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginLeft: 4 }}>
                          <Text style={s.commentT}>{timeAgo(c.created_at)}</Text>
                          <TouchableOpacity onPress={() => setReplyFor(c.id)} hitSlop={8}>
                            <Text style={[s.replyLink, isTarget && { color: C.ink }]}>{isTarget ? 'Replying…' : 'Reply'}</Text>
                          </TouchableOpacity>
                          {done ? <Text style={[s.commentT, { color: C.greenText }]}>✓ Answered</Text> : null}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {err ? <Text style={[s.err, { marginHorizontal: 12, marginBottom: 6 }]}>{err}</Text> : null}

          {target ? (
            <View style={[s.composer, { paddingBottom: kbOpen ? 8 : Math.max(insets.bottom, 8) }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingHorizontal: 4 }}>
                <Face name={target.author_name} avatar={target.author_avatar} size={18} />
                <Text style={[s.commentT, { flex: 1 }]} numberOfLines={1}>
                  Replying to <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: C.soft }}>{target.author_name || 'comment'}</Text> · {target.body}
                </Text>
              </View>
              <View style={s.composerField}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={`Reply to ${target.author_name || 'comment'}`}
                  placeholderTextColor={C.faint}
                  style={s.composerInput}
                  multiline
                />
                <TouchableOpacity
                  onPress={() => void sendCommentReply(target)}
                  disabled={busy || !draft.trim()}
                  style={[s.sendBtn, { opacity: busy || !draft.trim() ? 0.4 : 1 }]}
                  activeOpacity={0.8}
                  accessibilityLabel="Send reply"
                >
                  {busy ? <ActivityIndicator size="small" color="#0b1220" /> : <Ionicons name="arrow-up" size={18} color="#0b1220" />}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  const drawerModal = (
    <ChannelDrawer
      visible={drawer}
      channels={channels}
      value={channel}
      onPick={setChannel}
      onAddChannel={onConnect}
      onSettings={onConnect}
      onClose={() => setDrawer(false)}
    />
  );

  const openMeta = openConv ? SOCIAL_META[openConv.platform] : undefined;
  const openChannel = openConv ? channels.find((c) => c.id === openConv.channel_id)?.label : undefined;
  const canSend = !busy && !!msgDraft.trim();

  // Full-screen chat, messenger-style. The modal sits outside the app's safe
  // area, so it pads for the notch and home indicator itself, and the
  // KeyboardAvoidingView keeps the composer on top of the keyboard instead of
  // letting the thread run underneath it.
  const threadModal = (
    <Modal
      visible={!!openConv}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => setOpenConv(null)}
    >
      <View style={{ flex: 1, backgroundColor: C.bone, paddingTop: insets.top }}>
        <View style={s.threadHead}>
          <TouchableOpacity
            onPress={() => setOpenConv(null)}
            style={s.headBtn}
            activeOpacity={0.7}
            accessibilityLabel="Back to messages"
          >
            <Ionicons name="chevron-back" size={24} color={C.ink} />
          </TouchableOpacity>
          <View>
            <Face name={openConv?.participant_name ?? null} avatar={openConv?.participant_avatar ?? null} size={36} />
            {openConv ? (
              <View style={[s.faceBadge, { backgroundColor: openMeta?.bg ?? C.ink, borderColor: C.card }]}>
                <SocialGlyph platform={openConv.platform} size={8} color="#fff" />
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.threadName} numberOfLines={1}>{openConv?.participant_name ?? 'Conversation'}</Text>
            <Text style={s.commentT} numberOfLines={1}>
              {openConv ? providerLabel(openConv.platform) : ''}
              {openChannel ? ` · ${openChannel}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => void onRefresh()}
            style={s.headBtn}
            activeOpacity={0.7}
            disabled={refreshing}
            accessibilityLabel="Refresh conversation"
          >
            {refreshing ? <ActivityIndicator size="small" color={C.muted} /> : <Ionicons name="refresh" size={19} color={C.muted} />}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            ref={threadScroll}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => threadScroll.current?.scrollToEnd({ animated: false })}
            onLayout={() => threadScroll.current?.scrollToEnd({ animated: false })}
          >
            {thread === null ? (
              <ActivityIndicator color={C.accent} style={{ marginBottom: 24 }} />
            ) : thread.length === 0 ? (
              <Text style={[s.emptyS, { marginBottom: 24 }]}>No messages in this thread yet.</Text>
            ) : (
              thread.map((m, i) => {
                const out = m.direction === 'out';
                const prev = thread[i - 1];
                const next = thread[i + 1];
                const newDay = !prev || dayKey(prev.sent_at) !== dayKey(m.sent_at);
                // Consecutive lines from one side sit tight and share one face.
                const joinPrev = !newDay && prev?.direction === m.direction;
                const joinNext = !!next && next.direction === m.direction && dayKey(next.sent_at) === dayKey(m.sent_at);
                return (
                  <View key={m.id}>
                    {newDay ? (
                      <View style={s.dayRow}>
                        <View style={s.dayLine} />
                        <Text style={s.dayT}>{dayLabel(m.sent_at)}</Text>
                        <View style={s.dayLine} />
                      </View>
                    ) : null}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        justifyContent: out ? 'flex-end' : 'flex-start',
                        gap: 6,
                        marginTop: joinPrev ? 2 : 10,
                      }}
                    >
                      {!out ? (
                        joinNext ? (
                          <View style={{ width: 26 }} />
                        ) : (
                          <Face name={openConv?.participant_name ?? null} avatar={openConv?.participant_avatar ?? null} size={26} />
                        )
                      ) : null}
                      <View
                        style={[
                          s.bubble,
                          out
                            ? { backgroundColor: C.accent, borderBottomRightRadius: joinNext ? 20 : 6 }
                            : { backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft, borderBottomLeftRadius: joinNext ? 20 : 6 },
                          m.status === 'pending' && { opacity: 0.65 },
                        ]}
                      >
                        <Text style={[s.bubbleT, { color: out ? '#0b1220' : C.ink }]}>{m.body}</Text>
                        {!joinNext || m.status === 'pending' ? (
                          <Text style={[s.bubbleTime, { color: out ? 'rgba(11,18,32,0.55)' : C.faint, textAlign: out ? 'right' : 'left' }]}>
                            {clock(m.sent_at)}
                            {m.status === 'pending' ? ' · sending' : ''}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {err ? <Text style={[s.err, { marginHorizontal: 12, marginBottom: 6 }]}>{err}</Text> : null}

          <View style={[s.composer, { paddingBottom: kbOpen ? 8 : Math.max(insets.bottom, 8) }]}>
            <View style={s.composerField}>
              <TextInput
                value={msgDraft}
                onChangeText={setMsgDraft}
                placeholder={openChannel ? `Message as ${openChannel}` : 'Write a message…'}
                placeholderTextColor={C.faint}
                style={s.composerInput}
                multiline
              />
              <TouchableOpacity
                onPress={() => void sendDm()}
                disabled={!canSend}
                style={[s.sendBtn, { opacity: canSend ? 1 : 0.4 }]}
                activeOpacity={0.8}
                accessibilityLabel="Send message"
              >
                {busy ? <ActivityIndicator size="small" color="#0b1220" /> : <Ionicons name="arrow-up" size={18} color="#0b1220" />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  if (bare) {
    return (
      <View>
        {content}
        {drawerModal}
        {threadModal}
        {postModal}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 116 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} tintColor={C.accent} />}
      >
        {content}
      </ScrollView>
      {drawerModal}
      {threadModal}
      {postModal}
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  masthead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20 },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, marginTop: 6 },
  tabT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  tabOnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  chanBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 999, borderWidth: 1, borderColor: C.lineSoft, paddingHorizontal: 14, paddingVertical: 9 },
  chanBtnT: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
  feed: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.lineSoft, paddingHorizontal: 15 },
  postCard: { flexDirection: 'row', gap: 12, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.lineSoft, padding: 12 },
  postThumb: { width: 54, height: 54, borderRadius: 14, backgroundColor: C.surface },
  postBadge: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.card, alignItems: 'center', justifyContent: 'center' },
  postTitle: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: C.ink },
  postLatest: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, marginTop: 2 },
  commentCard: { flexDirection: 'row', gap: 11, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.lineSoft, padding: 12 },
  faceWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  author: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.ink, maxWidth: '70%' },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13.5, lineHeight: 19, color: C.soft },
  commentT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.faint },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  miniLogo: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  replyLink: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.accentInk },
  sentPill: { backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  sentPillT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 8.5, letterSpacing: 0.4, color: '#0b1220', textTransform: 'uppercase' },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft },
  convName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: C.ink },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  empty: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.lineSoft, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bone, alignItems: 'center', justifyContent: 'center' },
  emptyT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15.5, color: C.ink },
  emptyS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft, alignItems: 'center', justifyContent: 'center' },
  err: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#9F2F2D', backgroundColor: '#FDEBEC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  input: { backgroundColor: C.bone, borderRadius: 12, borderWidth: 1, borderColor: C.lineSoft, paddingHorizontal: 12, paddingVertical: 9, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.ink, maxHeight: 110 },
  smallBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  smallBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#fff' },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft, backgroundColor: C.bone },
  headBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  threadName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink },
  faceBadge: { position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 4 },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.lineSoft },
  dayT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, letterSpacing: 0.4, color: C.faint, textTransform: 'uppercase' },
  bubble: { maxWidth: '80%', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  bubbleT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, lineHeight: 20 },
  bubbleTime: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10.5, marginTop: 2 },
  composer: { paddingHorizontal: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft, backgroundColor: C.bone },
  composerField: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.lineSoft, paddingLeft: 14, paddingRight: 4, paddingVertical: 4 },
  // 16px keeps iOS from zooming the field; the cap stops a long draft from eating the thread.
  composerInput: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, lineHeight: 21, color: C.ink, maxHeight: 120, paddingTop: Platform.OS === 'ios' ? 8 : 6, paddingBottom: Platform.OS === 'ios' ? 8 : 6 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
});
