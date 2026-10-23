import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Platform,
} from 'react-native';
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

function providerLabel(provider: string): string {
  return SOCIAL_META[provider]?.label ?? provider;
}

/** Quick replies: one tap drops the text into the composer, never sends. */
const QUICK_COMMENT = ['Thanks for the kind words!', 'Thanks for reaching out', 'Check your DMs'];
const QUICK_DM = ['Thanks for reaching out', 'We are looking into it'];

type Status = 'needs' | 'replied' | 'all';

/** Person's picture (initial when there is none), with the platform's logo
 *  riding in the corner when `provider` is given. */
function Face({
  name,
  avatar,
  size = 34,
  provider,
  ring,
}: {
  name: string | null;
  avatar: string | null;
  size?: number;
  provider?: string;
  /** Colour of the surface behind the face, so the logo ring blends in. */
  ring?: string;
}) {
  const { C } = useTheme();
  const letter = (name ?? '').trim().replace('@', '').charAt(0).toUpperCase();
  const badge = Math.max(16, Math.round(size * 0.46));
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: C.surface,
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
      {provider ? (
        <View
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: badge,
            height: badge,
            borderRadius: badge / 2,
            backgroundColor: SOCIAL_META[provider]?.bg ?? C.ink,
            borderWidth: 2,
            borderColor: ring ?? C.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SocialGlyph platform={provider} size={Math.round(badge * 0.5)} color="#fff" />
        </View>
      ) : null}
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
  const [status, setStatus] = useState<Status>('all');
  const [drawer, setDrawer] = useState(false);
  const [openRootId, setOpenRootId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [openConv, setOpenConv] = useState<CommunityConversation | null>(null);
  const [thread, setThread] = useState<CommunityMessage[] | null>(null);
  const [msgDraft, setMsgDraft] = useState('');

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

  const sendCommentReply = async (c: CommunityComment) => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await replyToCommunityComment(c.id, text);
      setDraft('');
      setReplyTarget(null);
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

  const providerOf = (id: string) => channels.find((c) => c.id === id)?.provider ?? 'x';

  /** Threads: roots (comments nobody in this view replies to), each with its
   *  reply tree. A reply whose parent is filtered out is promoted to a root. */
  const threads = useMemo(() => {
    const list = comments.filter((c) => channel === 'all' || c.channel_id === channel);
    const byKey = new Map(list.map((c) => [`${c.channel_id}:${c.external_id}`, c]));
    const kids = new Map<string, CommunityComment[]>();
    const roots: CommunityComment[] = [];
    for (const c of list) {
      const parent = c.parent_external_id ? byKey.get(`${c.channel_id}:${c.parent_external_id}`) : undefined;
      if (parent && parent.id !== c.id) {
        const arr = kids.get(parent.id) ?? [];
        arr.push(c);
        kids.set(parent.id, arr);
      } else {
        roots.push(c);
      }
    }
    roots.sort((a, b) => b.created_at.localeCompare(a.created_at));
    for (const arr of kids.values()) arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const info = new Map<string, { last: CommunityComment; hasNew: boolean; needs: boolean; count: number }>();
    const collect = (r: CommunityComment, acc: CommunityComment[]): CommunityComment[] => {
      acc.push(r);
      for (const k of kids.get(r.id) ?? []) collect(k, acc);
      return acc;
    };
    for (const root of roots) {
      const all = collect(root, []);
      const last = all.reduce((a, b) => (b.created_at > a.created_at ? b : a));
      const hasNew = all.some((r) => !r.is_own && r.status === 'new');
      const closed = last.status === 'replied' || last.status === 'hidden' || last.status === 'deleted';
      info.set(root.id, { last, hasNew, needs: hasNew || (!last.is_own && !closed), count: all.length });
    }
    return { roots, kids, info };
  }, [comments, channel]);

  const needsCount = threads.roots.filter((r) => threads.info.get(r.id)?.needs).length;
  const visibleRoots = threads.roots.filter((r) => {
    const i = threads.info.get(r.id);
    if (status === 'needs') return !!i?.needs;
    if (status === 'replied') return !i?.needs;
    return true;
  });
  const openRoot = openRootId ? threads.roots.find((r) => r.id === openRootId) ?? null : null;

  /** New-comment count per channel, for the little badges on the logo row. */
  const newByChannel = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comments) {
      if (!c.is_own && c.status === 'new') m.set(c.channel_id, (m.get(c.channel_id) ?? 0) + 1);
    }
    return m;
  }, [comments]);

  const closeThread = () => {
    setOpenRootId(null);
    setReplyTarget(null);
    setDraft('');
  };

  const commentRow = (c: CommunityComment, depth: number): React.ReactNode => {
    const provider = c.platform;
    const meta = SOCIAL_META[provider];
    const canReply = !c.is_own;
    const kids = threads.kids.get(c.id) ?? [];
    return (
      <View key={c.id} style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 11 }}>
          {c.is_own ? (
            <View style={[s.faceWrap, { backgroundColor: meta?.bg ?? C.ink, width: depth ? 30 : 40, height: depth ? 30 : 40, borderRadius: depth ? 15 : 20 }]}>
              <SocialGlyph platform={provider} size={depth ? 14 : 18} color="#fff" />
            </View>
          ) : (
            <Face name={c.author_name} avatar={c.author_avatar} size={depth ? 30 : 40} />
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={s.author} numberOfLines={1}>
                {c.is_own ? 'You' : c.author_name || 'Unknown'}
              </Text>
              {c.is_own ? (
                <View style={s.pill}>
                  <Text style={s.pillT}>Sent</Text>
                </View>
              ) : c.status === 'new' ? (
                <View style={[s.pill, { backgroundColor: C.accent }]}>
                  <Text style={[s.pillT, { color: '#0b1220' }]}>New</Text>
                </View>
              ) : null}
              <Text style={s.commentT}>{c.created_at ? timeAgo(c.created_at) : ''}</Text>
            </View>
            <Text style={s.body}>{c.body || '(empty comment)'}</Text>
            {canReply ? (
              <TouchableOpacity
                onPress={() => setReplyTarget(c.id)}
                activeOpacity={0.7}
                style={{ marginTop: 4, alignSelf: 'flex-start', paddingVertical: 4 }}
              >
                <Text style={s.replyLink}>Reply</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {kids.length ? (
          <View style={[s.rail, { marginLeft: depth ? 14 : 19 }]}>{kids.map((k) => commentRow(k, depth + 1))}</View>
        ) : null}
      </View>
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

      <View style={{ paddingHorizontal: 20, marginTop: bare ? 0 : 16 }}>
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
                <Text style={[s.tabT, active && { color: C.onInk }]}>{o.label}</Text>
                {count > 0 ? (
                  <View
                    style={{
                      minWidth: 18,
                      paddingHorizontal: 5,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: active ? C.bone : C.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: active ? C.ink : '#0b1220' }}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      </View>

      {/* Channel logos: tap one to filter, the list button opens the full drawer. */}
      <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 20, paddingRight: 8, gap: 8, alignItems: 'center', paddingVertical: 6 }}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            onPress={() => setChannel('all')}
            style={[s.allChip, channel === 'all' && { backgroundColor: C.accent, borderColor: C.accent }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: channel === 'all' }}
          >
            <Text style={[s.allChipT, channel === 'all' && { color: '#0b1220' }]}>All</Text>
          </TouchableOpacity>
          {channels.map((ch) => {
            const on = channel === ch.id;
            const n = newByChannel.get(ch.id) ?? 0;
            return (
              <TouchableOpacity
                key={ch.id}
                onPress={() => setChannel(on ? 'all' : ch.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${ch.label}${n ? `, ${n} new` : ''}`}
                accessibilityState={{ selected: on }}
                style={[s.logoChip, { backgroundColor: SOCIAL_META[ch.provider]?.bg ?? C.ink }, on && { borderColor: C.accent, borderWidth: 2.5 }]}
              >
                <SocialGlyph platform={ch.provider} size={17} color="#fff" />
                {n > 0 ? (
                  <View style={[s.chipBadge, { borderColor: C.bone }]}>
                    <Text style={s.chipBadgeT}>{n > 9 ? '9+' : n}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8, paddingRight: 20, paddingLeft: 4 }}>
          <TouchableOpacity onPress={() => setDrawer(true)} style={s.iconBtn} activeOpacity={0.75} accessibilityLabel="All channels">
            <Ionicons name="list" size={17} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void onRefresh()} style={s.iconBtn} activeOpacity={0.75} disabled={refreshing} accessibilityLabel="Refresh">
            {refreshing ? <ActivityIndicator size="small" color={C.muted} /> : <Ionicons name="refresh" size={16} color={C.muted} />}
          </TouchableOpacity>
        </View>
      </View>

      {segment === 'comments' ? (
        <View style={{ paddingHorizontal: 20, marginTop: 10, flexDirection: 'row', gap: 8 }}>
          {(
            [
              { key: 'needs', label: `Needs reply${needsCount ? ` · ${needsCount}` : ''}` },
              { key: 'replied', label: 'Replied' },
              { key: 'all', label: 'All' },
            ] as { key: Status; label: string }[]
          ).map(({ key, label }) => {
            const on = status === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setStatus(key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[s.statusChip, on && { borderColor: C.accent, backgroundColor: C.accentSoft }]}
              >
                <Text style={[s.statusChipT, on && { color: C.yellowText }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {err ? (
        <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
          <Text style={s.err}>{err}</Text>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
        {loading ? (
          <View style={s.empty}>
            <ActivityIndicator size="small" color={C.accent} />
            <Text style={s.emptyS}>Loading inbox…</Text>
          </View>
        ) : segment === 'comments' ? (
          visibleRoots.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="chatbubbles" size={20} color={C.faint} />
              </View>
              <Text style={s.emptyT}>{threads.roots.length === 0 ? 'No comments yet' : 'Nothing here'}</Text>
              <Text style={s.emptyS}>
                {threads.roots.length === 0
                  ? 'Comments on your posts land here when the engine sweeps, every 5 minutes or on Refresh.'
                  : status === 'needs'
                    ? 'Nothing needs a reply. Nice.'
                    : 'No threads match this filter.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {visibleRoots.map((root) => {
                const i = threads.info.get(root.id);
                const meta = SOCIAL_META[root.platform];
                const last = i?.last ?? root;
                return (
                  <TouchableOpacity key={root.id} style={s.card} onPress={() => setOpenRootId(root.id)} activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      {root.is_own ? (
                        <View style={[s.faceWrap, { backgroundColor: meta?.bg ?? C.ink, width: 40, height: 40, borderRadius: 20 }]}>
                          <SocialGlyph platform={root.platform} size={18} color="#fff" />
                        </View>
                      ) : (
                        <Face name={root.author_name} avatar={root.author_avatar} size={40} provider={root.platform} />
                      )}
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={[s.author, { flexShrink: 1 }]} numberOfLines={1}>
                            {root.is_own ? 'You' : root.author_name || 'Unknown'}
                          </Text>
                          <Text style={s.commentT}>{timeAgo(last.created_at)}</Text>
                          {i?.hasNew ? <View style={[s.unreadDot, { marginLeft: 'auto' }]} /> : null}
                        </View>
                        <Text style={s.body} numberOfLines={3}>
                          {last.is_own ? 'You: ' : ''}
                          {last.body || '(empty comment)'}
                        </Text>
                      </View>
                    </View>
                    <View style={s.cardFoot}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <View style={[s.miniLogo, { backgroundColor: meta?.bg ?? C.ink }]}>
                          <SocialGlyph platform={root.platform} size={8} color="#fff" />
                        </View>
                        <Text style={s.commentT} numberOfLines={1}>
                          {meta?.label ?? root.platform}
                          {i && i.count > 1 ? ` · ${i.count - 1} ${i.count - 1 === 1 ? 'reply' : 'replies'}` : ''}
                        </Text>
                      </View>
                      <View style={[s.smallBtn, i?.needs ? { backgroundColor: C.accent } : { backgroundColor: C.surface }]}>
                        <Text style={[s.smallBtnT, { color: i?.needs ? '#0b1220' : C.soft }]}>{i?.needs ? 'Reply' : 'View'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
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
          <View style={{ gap: 2 }}>
            {convs
              .filter((c) => channel === 'all' || c.channel_id === channel)
              .map((c) => {
                const meta = SOCIAL_META[c.platform];
                const unread = c.unread_count > 0;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.convRow, unread && { backgroundColor: C.card, borderColor: C.lineSoft }]}
                    onPress={() => void openThread(c)}
                    activeOpacity={0.7}
                  >
                    <Face name={c.participant_name} avatar={c.participant_avatar} size={48} provider={c.platform} ring={unread ? C.card : C.bone} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[s.convName, { flex: 1 }, unread && { fontFamily: 'PlusJakartaSans_800ExtraBold' }]} numberOfLines={1}>
                          {c.participant_name || 'Conversation'}
                        </Text>
                        <Text style={[s.commentT, unread && { color: C.yellowText }]}>{c.last_message_at ? timeAgo(c.last_message_at) : ''}</Text>
                      </View>
                      <Text style={s.commentT} numberOfLines={1}>
                        {meta?.label ?? c.platform}
                      </Text>
                    </View>
                    {unread ? (
                      <View style={s.countBadge}>
                        <Text style={s.countBadgeT}>{c.unread_count > 9 ? '9+' : c.unread_count}</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={C.faint} />
                    )}
                  </TouchableOpacity>
                );
              })}
          </View>
        )}
      </View>
    </>
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

  const replyingTo = openRoot
    ? (replyTarget && replyTarget !== openRoot.id
        ? comments.find((x) => x.id === replyTarget) ?? null
        : null)
    : null;
  const replyTargetRow = replyingTo ?? openRoot;
  const rootMeta = openRoot ? SOCIAL_META[openRoot.platform] : undefined;

  const commentThreadModal = (
    <Modal visible={!!openRoot} animationType="slide" onRequestClose={closeThread}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bone }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.threadHead}>
          <TouchableOpacity onPress={closeThread} style={s.headBtn} activeOpacity={0.7} accessibilityLabel="Back to comments">
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.convName} numberOfLines={1}>Comment thread</Text>
            <Text style={s.commentT}>{openRoot ? providerLabel(openRoot.platform) : ''}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
          {openRoot ? commentRow(openRoot, 0) : null}
        </ScrollView>

        {openRoot ? (
          <View style={s.sheet}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
              {QUICK_COMMENT.map((t) => (
                <TouchableOpacity key={t} onPress={() => setDraft(t)} style={s.quick} activeOpacity={0.8}>
                  <Text style={s.quickT}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="return-down-forward" size={13} color={C.muted} />
              <Text style={s.commentT} numberOfLines={1}>
                Replying to <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: C.ink }}>{replyTargetRow?.author_name || 'comment'}</Text>
                {rootMeta ? ` on ${rootMeta.label}` : ''}
              </Text>
              {replyingTo ? (
                <TouchableOpacity onPress={() => setReplyTarget(null)} style={{ marginLeft: 'auto', padding: 2 }} accessibilityLabel="Reply to the whole thread instead">
                  <Ionicons name="close" size={14} color={C.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={`Reply on ${rootMeta?.label ?? providerLabel(openRoot.platform)}`}
                placeholderTextColor={C.faint}
                multiline
                style={[s.input, { flex: 1 }]}
              />
              <TouchableOpacity
                onPress={() => replyTargetRow && void sendCommentReply(replyTargetRow)}
                disabled={busy || !draft.trim() || !replyTargetRow || replyTargetRow.is_own}
                style={[s.sendBtn, { backgroundColor: C.accent, opacity: busy || !draft.trim() || !replyTargetRow || replyTargetRow.is_own ? 0.5 : 1 }]}
                activeOpacity={0.8}
                accessibilityLabel="Send reply"
              >
                {busy ? <ActivityIndicator size="small" color="#0b1220" /> : <Ionicons name="send" size={17} color="#0b1220" />}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );

  const dmThreadModal = (
    <Modal visible={!!openConv} animationType="slide" onRequestClose={() => setOpenConv(null)}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bone }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.threadHead}>
          <TouchableOpacity onPress={() => setOpenConv(null)} style={s.headBtn} activeOpacity={0.7} accessibilityLabel="Back to messages">
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Face
            name={openConv?.participant_name ?? null}
            avatar={openConv?.participant_avatar ?? null}
            size={40}
            provider={openConv?.platform}
            ring={C.bone}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.convName} numberOfLines={1}>{openConv?.participant_name ?? 'Conversation'}</Text>
            <Text style={s.commentT}>{openConv ? providerLabel(openConv.platform) : ''}</Text>
          </View>
          <TouchableOpacity onPress={() => void onRefresh()} style={s.headBtn} activeOpacity={0.7} accessibilityLabel="Refresh">
            <Ionicons name="refresh" size={18} color={C.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 6 }} keyboardShouldPersistTaps="handled">
          {thread === null ? (
            <ActivityIndicator color={C.accent} />
          ) : thread.length === 0 ? (
            <Text style={[s.emptyS, { textAlign: 'center', marginTop: 24 }]}>No messages in this thread yet.</Text>
          ) : (
            thread.map((m, idx) => {
              const out = m.direction === 'out';
              const prev = idx > 0 ? thread[idx - 1] : null;
              const newDay = !prev || new Date(prev.sent_at).toDateString() !== new Date(m.sent_at).toDateString();
              return (
                <View key={m.id} style={{ gap: 6 }}>
                  {newDay ? (
                    <Text style={[s.commentT, { textAlign: 'center', marginVertical: 8, fontFamily: 'PlusJakartaSans_700Bold' }]}>
                      {new Date(m.sent_at).toDateString() === new Date().toDateString()
                        ? 'Today'
                        : new Date(m.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, justifyContent: out ? 'flex-end' : 'flex-start' }}>
                    {!out ? (
                      <Face name={openConv?.participant_name ?? null} avatar={openConv?.participant_avatar ?? null} size={26} ring={C.bone} />
                    ) : null}
                    <View
                      style={[
                        s.bubble,
                        out
                          ? { backgroundColor: C.accent, borderBottomRightRadius: 6, opacity: m.status === 'pending' ? 0.7 : 1 }
                          : { backgroundColor: C.surface, borderBottomLeftRadius: 6 },
                      ]}
                    >
                      <Text style={[s.bubbleT, { color: out ? '#0b1220' : C.ink }]}>{m.body}</Text>
                      <Text style={[s.bubbleT, { fontSize: 10.5, marginTop: 3, color: out ? '#0b1220' : C.muted, opacity: out ? 0.65 : 1 }]}>
                        {timeAgo(m.sent_at)}
                        {m.status === 'pending' ? ' · sending' : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={s.sheet}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
            {QUICK_DM.map((t) => (
              <TouchableOpacity key={t} onPress={() => setMsgDraft(t)} style={s.quick} activeOpacity={0.8}>
                <Text style={s.quickT}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <TextInput
              value={msgDraft}
              onChangeText={setMsgDraft}
              placeholder="Write a message…"
              placeholderTextColor={C.faint}
              style={[s.input, { flex: 1 }]}
              multiline
            />
            <TouchableOpacity
              onPress={() => void sendDm()}
              disabled={busy || !msgDraft.trim()}
              style={[s.sendBtn, { backgroundColor: C.accent, opacity: busy || !msgDraft.trim() ? 0.5 : 1 }]}
              activeOpacity={0.8}
              accessibilityLabel="Send message"
            >
              {busy ? <ActivityIndicator size="small" color="#0b1220" /> : <Ionicons name="send" size={17} color="#0b1220" />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (bare) {
    return (
      <View>
        {content}
        {drawerModal}
        {commentThreadModal}
        {dmThreadModal}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.bone }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} tintColor={C.accent} />}
      >
        {content}
      </ScrollView>
      {drawerModal}
      {commentThreadModal}
      {dmThreadModal}
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  masthead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20 },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, marginTop: 6 },
  tabT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  allChip: { height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  allChipT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: C.ink },
  logoChip: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  chipBadge: { position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: C.accent, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chipBadgeT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 9.5, color: '#0b1220' },
  statusChip: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  statusChipT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  card: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.lineSoft, padding: 14, gap: 12 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  faceWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  author: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: C.ink },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14.5, lineHeight: 21, color: C.soft },
  commentT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted },
  miniLogo: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  replyLink: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.accentInk },
  rail: { borderLeftWidth: 2, borderLeftColor: C.line, paddingLeft: 20, gap: 16 },
  pill: { backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  pillT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 8.5, letterSpacing: 0.4, color: C.yellowText, textTransform: 'uppercase' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: 'transparent' },
  convName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: C.ink },
  countBadge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  countBadgeT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, color: '#0b1220' },
  empty: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.lineSoft, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  emptyT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15.5, color: C.ink },
  emptyS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft, alignItems: 'center', justifyContent: 'center' },
  err: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#9F2F2D', backgroundColor: '#FDEBEC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  input: { backgroundColor: C.bone, borderRadius: 24, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: C.ink, maxHeight: 120, minHeight: 48 },
  smallBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  smallBtnT: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13 },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingTop: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft, backgroundColor: C.bone },
  headBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleT: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14.5, lineHeight: 21 },
  sheet: { gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft, backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  quick: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  quickT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.soft },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
