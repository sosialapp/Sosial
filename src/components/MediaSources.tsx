import React, { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  FlatList, Image, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useTheme, Palette } from '../theme';
import SourceMark, { type SourceMarkId } from './SourceMarks';
import { searchStock, downloadStockItem, unsplashCredit, type StockItem } from '../utils/stockMedia';
import {
  filesConnected, loginGoogleFiles, disconnectGoogleFiles,
  listDriveFiles, listDriveFolders, downloadDriveFile, type DriveFile,
  createPhotosSession, photosSessionDone, listPickedPhotos, downloadPhotosItem, type PhotosItem,
} from '../utils/driveAuth';
import {
  dropboxConnected, loginDropbox, disconnectDropbox,
  listDropboxFolder, searchDropbox, downloadDropboxFile, type DropboxEntry,
} from '../utils/dropboxAuth';
import {
  canvaConnected, loginCanva, disconnectCanva,
  listCanvaDesigns, downloadCanvaDesign, type CanvaDesign,
} from '../utils/canvaAuth';

export interface SourceAttachment {
  uri: string;
  kind: 'image' | 'video';
}

type Source = 'unsplash' | 'drive' | 'gphotos' | 'dropbox' | 'canva';

const SOURCES: { id: Source; label: string; icon: string; mark: SourceMarkId; note: string }[] = [
  { id: 'dropbox', label: 'Dropbox', icon: 'cloud-outline', mark: 'dropbox', note: 'Your Dropbox files' },
  { id: 'canva', label: 'Canva', icon: 'color-palette-outline', mark: 'canva', note: 'Your designs, exported to post' },
  { id: 'unsplash', label: 'Unsplash', icon: 'camera-outline', mark: 'unsplash', note: 'Photos · credit auto-added' },
];

/** Not yet wired — Google media awaits Google OAuth verification (restricted
 *  scopes + CASA); OneDrive awaits the Azure app. Shown greyed as roadmap. */
const SOON: { label: string; icon: string; note: string }[] = [
  { label: 'Google Drive', icon: 'folder-outline', note: 'Coming soon' },
  { label: 'Google Photos', icon: 'images-outline', note: 'Coming soon' },
  { label: 'OneDrive', icon: 'cloud-outline', note: 'Coming soon' },
];

const LABEL: Record<Source, string> = {
  drive: 'Google Drive',
  gphotos: 'Google Photos',
  dropbox: 'Dropbox',
  canva: 'Canva',
  unsplash: 'Unsplash',
};

/**
 * Media sources browser (inline view — never a Modal, because iOS cannot
 * reliably present a modal over the composer sheet's Modal). Hosts render it
 * full-screen (a Modal of their own) or swap it into their layout.
 * Emits composer-ready attachments; Unsplash items also return a credit line
 * the caller appends to the caption. Drive + Photos tokens stay device-side
 * (SecureStore); Dropbox/OneDrive/Canva land as tiles here as they ship.
 */
export default function MediaSources({
  onPickLocal,
  onAttach,
  onClose,
}: {
  onPickLocal: () => void;
  onAttach: (items: SourceAttachment[], credit?: string) => void;
  onClose: () => void;
}) {
  const { C } = useTheme();
  const s = makeS(C);
  const [source, setSource] = useState<Source | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'photo' | 'video'>('photo');
  const [items, setItems] = useState<StockItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  // Drive / Photos
  const [filesAuthed, setFilesAuthed] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveNext, setDriveNext] = useState<string | undefined>(undefined);
  const [photos, setPhotos] = useState<PhotosItem[]>([]);
  // Dropbox
  const [dbxAuthed, setDbxAuthed] = useState(false);
  const [dbxFolders, setDbxFolders] = useState<DropboxEntry[]>([]);
  const [dbxStack, setDbxStack] = useState<{ name: string; path: string }[]>([]);
  const [dbxFiles, setDbxFiles] = useState<DropboxEntry[]>([]);
  // Canva
  const [canvaAuthed, setCanvaAuthed] = useState(false);
  const [canvaDesigns, setCanvaDesigns] = useState<CanvaDesign[]>([]);
  const [canvaKind, setCanvaKind] = useState<'image' | 'video'>('image');

  const loadDrive = async (folderId?: string, q?: string, more?: boolean) => {
    setBusy(true);
    try {
      const [fl, fo] = await Promise.all([
        listDriveFiles(folderId, q, more ? driveNext : undefined),
        more ? Promise.resolve(null) : listDriveFolders(folderId),
      ]);
      setDriveFiles(more ? [...driveFiles, ...fl.files] : fl.files);
      setDriveNext(fl.nextPage);
      if (fo) setFolders(fo);
    } catch (e: any) {
      Alert.alert('Drive failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  /** Photos picker session: system browser Google UI → poll → auto-attach. */
  const [picking, setPicking] = useState(false);
  const openPhotosPicker = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const session = await createPhotosSession();
      try {
        await WebBrowser.openBrowserAsync(session.pickerUri);
      } catch {}
      const deadline = Date.now() + 8 * 60 * 1000;
      let done = false;
      let lastPollErr: string | null = null;
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          if (await photosSessionDone(session.id)) {
            done = true;
            break;
          }
          lastPollErr = null;
        } catch (e: any) {
          lastPollErr = e?.message ?? 'Poll failed.';
        }
        if (Date.now() > deadline) break;
      }
      if (!done) {
        if (lastPollErr) throw new Error(lastPollErr);
        Alert.alert('Nothing picked', 'Open the picker and choose at least one photo, then come back.');
        return;
      }
      const picked = await listPickedPhotos(session.id);
      if (!picked.length) {
        Alert.alert('Nothing picked', 'Try again — pick at least one photo.');
        return;
      }
      // Auto-attach: download each picked item straight into the composer.
      const items: SourceAttachment[] = [];
      for (const p of picked) {
        try {
          items.push(await downloadPhotosItem(p));
        } catch {
          /* one bad item must not sink the batch */
        }
      }
      if (!items.length) {
        Alert.alert('Could not fetch', 'The picked photos would not download — try again.');
        return;
      }
      onAttach(items);
      onClose();
    } catch (e: any) {
      Alert.alert('Photos picker failed', e?.message ?? 'Try again.');
    } finally {
      setPicking(false);
    }
  };

  const loadDropbox = async (path?: string) => {
    setBusy(true);
    try {
      const r = await listDropboxFolder(path);
      setDbxFolders(r.folders);
      setDbxFiles(r.files);
    } catch (e: any) {
      Alert.alert('Dropbox failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const loadCanva = async (q?: string) => {
    setBusy(true);
    try {
      const r = await listCanvaDesigns(q);
      setCanvaDesigns(r.designs);
    } catch (e: any) {
      Alert.alert('Canva failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    if (!source || !query.trim() || busy) return;
    setBusy(true);
    try {
      if (source === 'drive') {
        await loadDrive(folderStack.length ? folderStack[folderStack.length - 1].id : undefined, query.trim());
      } else if (source === 'gphotos') {
        // Picker has its own search UI — the dialog search box is hidden.
        return;
      } else if (source === 'dropbox') {
        setBusy(true);
        try {
          setDbxFiles(await searchDropbox(query.trim()));
          setDbxFolders([]);
        } catch (e: any) {
          Alert.alert('Search failed', e?.message ?? 'Try again.');
        } finally {
          setBusy(false);
        }
        return;
      } else if (source === 'canva') {
        await loadCanva(query.trim());
        return;
      } else {
        setItems(await searchStock('unsplash', query.trim(), 'photo'));
      }
    } catch (e: any) {
      Alert.alert('Search failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (item: StockItem) => {
    if (downloading) return;
    setDownloading(item.id);
    try {
      const att = await downloadStockItem(item);
      onAttach([att], item.source === 'unsplash' ? unsplashCredit(item) : undefined);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not attach', e?.message ?? 'Try another one.');
    } finally {
      setDownloading(null);
    }
  };

  const pickDrive = async (f: DriveFile) => {
    if (downloading) return;
    setDownloading(f.id);
    try {
      const att = await downloadDriveFile(f);
      onAttach([att]);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not attach', e?.message ?? 'Try another file.');
    } finally {
      setDownloading(null);
    }
  };

  const pickPhoto = async (p: PhotosItem) => {
    if (downloading) return;
    setDownloading(p.id);
    try {
      const att = await downloadPhotosItem(p);
      onAttach([att]);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not attach', e?.message ?? 'Try another one.');
    } finally {
      setDownloading(null);
    }
  };

  const pickDropbox = async (f: DropboxEntry) => {
    if (downloading) return;
    setDownloading(f.path);
    try {
      const att = await downloadDropboxFile(f);
      onAttach([att]);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not attach', e?.message ?? 'Try another file.');
    } finally {
      setDownloading(null);
    }
  };

  const pickCanva = async (d: CanvaDesign) => {
    if (downloading) return;
    setDownloading(d.id);
    try {
      const att = await downloadCanvaDesign(d, canvaKind);
      onAttach([att]);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not attach', e?.message ?? 'Try another design.');
    } finally {
      setDownloading(null);
    }
  };

  const openSource = async (id: Source) => {
    setSource(id);
    setItems([]);
    setQuery('');
    setDriveFiles([]);
    setPhotos([]);
    setFolders([]);
    setFolderStack([]);
    setDriveNext(undefined);
    setDbxFolders([]);
    setDbxFiles([]);
    setDbxStack([]);
    setCanvaDesigns([]);
    if (id === 'unsplash') setType('photo');
    if (id === 'drive' || id === 'gphotos') {
      const ok = await filesConnected();
      setFilesAuthed(ok);
      if (ok && id === 'drive') await loadDrive();
      // gphotos needs no preload — the picker button opens Google's UI.
    }
    if (id === 'dropbox') {
      const ok = await dropboxConnected();
      setDbxAuthed(ok);
      if (ok) await loadDropbox();
    }
    if (id === 'canva') {
      const ok = await canvaConnected();
      setCanvaAuthed(ok);
      if (ok) await loadCanva();
    }
  };

  const connectFiles = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      if (source === 'dropbox') {
        const ok = await loginDropbox();
        if (!ok) {
          Alert.alert('Not connected', 'Dropbox sign-in was cancelled.');
          return;
        }
        setDbxAuthed(true);
        await loadDropbox();
        return;
      }
      if (source === 'canva') {
        const ok = await loginCanva();
        if (!ok) {
          Alert.alert('Not connected', 'Canva sign-in was cancelled.');
          return;
        }
        setCanvaAuthed(true);
        await loadCanva();
        return;
      }
      const ok = await loginGoogleFiles();
      if (!ok) {
        Alert.alert('Not connected', 'Google sign-in was cancelled.');
        return;
      }
      setFilesAuthed(true);
      if (source === 'drive') await loadDrive();
      // gphotos needs no preload — the picker button opens Google's UI.
    } catch (e: any) {
      Alert.alert('Could not connect', e?.message ?? 'Try again.');
    } finally {
      setConnecting(false);
    }
  };

  const goBack = () => {
    setSource(null);
    setItems([]);
    setDriveFiles([]);
    setPhotos([]);
    setFilesAuthed(false);
    setDbxAuthed(false);
    setCanvaAuthed(false);
  };

  const disconnectSource = () => {
    if (!source) return;
    const name = LABEL[source];
    Alert.alert(`Disconnect ${name}?`, 'This forgets the login on this device. Your files stay untouched.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            if (source === 'dropbox') {
              await disconnectDropbox();
              setDbxAuthed(false);
            } else if (source === 'canva') {
              await disconnectCanva();
              setCanvaAuthed(false);
            } else {
              await disconnectGoogleFiles();
              setFilesAuthed(false);
            }
          } catch {}
        },
      },
    ]);
  };

  const isCloud = source === 'drive' || source === 'gphotos' || source === 'dropbox' || source === 'canva';
  const cloudAuthed = source === 'dropbox' ? dbxAuthed : source === 'canva' ? canvaAuthed : filesAuthed;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.title}>Add media</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Ionicons name="close-circle" size={24} color={C.muted} />
        </TouchableOpacity>
      </View>

      {!source ? (
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => { onClose(); onPickLocal(); }}
            activeOpacity={0.75}
            style={s.tile}
          >
            <Ionicons name="images-outline" size={22} color={C.accentInk} />
            <View style={{ flex: 1 }}>
              <Text style={s.tileT}>Camera roll</Text>
              <Text style={s.tileS}>Photos and videos on this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </TouchableOpacity>
          {SOURCES.map((src) => (
            <TouchableOpacity key={src.id} onPress={() => openSource(src.id)} activeOpacity={0.75} style={s.tile}>
              <SourceMark id={src.mark} size={22} color={C.ink} />
              <View style={{ flex: 1 }}>
                <Text style={s.tileT}>{src.label}</Text>
                <Text style={s.tileS}>{src.note}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            </TouchableOpacity>
          ))}
          {SOON.map((src) => (
            <TouchableOpacity
              key={src.label}
              onPress={() => Alert.alert(`${src.label} is coming soon`, 'We are wiring it up next — check back shortly.')}
              activeOpacity={0.75}
              style={[s.tile, { opacity: 0.55 }]}
            >
              <Ionicons name={src.icon as any} size={22} color={C.faint} />
              <View style={{ flex: 1 }}>
                <Text style={s.tileT}>{src.label}</Text>
                <Text style={s.tileS}>{src.note}</Text>
              </View>
              <Text style={s.soonBadge}>Soon</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={s.sourceHead}>
            <TouchableOpacity onPress={goBack} style={s.back}>
              <Ionicons name="chevron-back" size={16} color={C.accentInk} />
              <Text style={s.backT}>{LABEL[source]}</Text>
            </TouchableOpacity>
            {isCloud && cloudAuthed ? (
              <TouchableOpacity onPress={disconnectSource} hitSlop={8}>
                <Text style={s.disconnectT}>Disconnect</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isCloud && !cloudAuthed ? (
            <View style={s.connectBox}>
              <Text style={s.connectT}>
                {source === 'drive'
                  ? 'Connect Google Drive to browse your files.'
                  : source === 'dropbox'
                    ? 'Connect Dropbox to browse your files.'
                    : source === 'canva'
                      ? 'Connect Canva to browse your designs.'
                      : 'Connect Google Photos to browse your library.'}
              </Text>
              <Text style={s.connectS}>Read-only access · tokens stay on this device.</Text>
              <TouchableOpacity onPress={connectFiles} style={s.connectBtn} activeOpacity={0.8} disabled={connecting}>
                {connecting ? (
                  <ActivityIndicator size="small" color={C.onInk} />
                ) : (
                  <Text style={s.connectBtnT}>{source === 'dropbox' ? 'Connect Dropbox' : source === 'canva' ? 'Connect Canva' : 'Connect Google'}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {source !== 'gphotos' ? (
              <View style={s.searchRow}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={source === 'drive' ? 'Search Drive…' : source === 'dropbox' ? 'Search Dropbox…' : source === 'canva' ? 'Search designs…' : 'Search stock…'}
                  placeholderTextColor={C.faint}
                  style={s.search}
                  returnKeyType="search"
                  onSubmitEditing={search}
                />
                <TouchableOpacity onPress={search} style={s.go} activeOpacity={0.75}>
                  {busy ? <ActivityIndicator size="small" color={C.onInk} /> : <Text style={s.goT}>Go</Text>}
                </TouchableOpacity>
              </View>
              ) : null}

              {source === 'canva' ? (
                <View style={s.typeRow}>
                  {(['photo', 'video'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => (source === 'canva' ? setCanvaKind(t === 'photo' ? 'image' : 'video') : setType(t))}
                      style={[s.typePill, (source === 'canva' ? canvaKind === (t === 'photo' ? 'image' : 'video') : type === t) && { backgroundColor: C.ink }]}
                    >
                      <Text style={[s.typeT, (source === 'canva' ? canvaKind === (t === 'photo' ? 'image' : 'video') : type === t) && { color: C.onInk }]}>
                        {t === 'photo' ? 'Photos' : 'Videos'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {source === 'unsplash' ? (
                <Text style={s.creditNote}>Photographer credit is added to your caption automatically.</Text>
              ) : null}

              {source === 'dropbox' && dbxFolders.length > 0 && !query.trim() ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 8 }}>
                  {dbxStack.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => {
                        const next = dbxStack.slice(0, -1);
                        setDbxStack(next);
                        setQuery('');
                        void loadDropbox(next.length ? next[next.length - 1].path : undefined);
                      }}
                      style={s.folderChip}
                    >
                      <Ionicons name="arrow-up" size={13} color={C.accentInk} />
                      <Text style={s.folderT}>Up</Text>
                    </TouchableOpacity>
                  ) : null}
                  {dbxFolders.map((f) => (
                    <TouchableOpacity
                      key={f.path}
                      onPress={() => {
                        const next = [...dbxStack, { name: f.name, path: f.path }];
                        setDbxStack(next);
                        setQuery('');
                        void loadDropbox(f.path);
                      }}
                      style={s.folderChip}
                    >
                      <Ionicons name="folder" size={13} color={C.accentInk} />
                      <Text style={s.folderT} numberOfLines={1}>{f.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}

              {source === 'drive' ? (
                <FlatList
                  data={driveFiles}
                  keyExtractor={(x) => x.id}
                  numColumns={3}
                  contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: 20 }}
                  columnWrapperStyle={{ gap: 8 }}
                  keyboardShouldPersistTaps="handled"
                  onEndReached={() => { if (driveNext && !busy) void loadDrive(folderStack.length ? folderStack[folderStack.length - 1].id : undefined, query.trim() || undefined, true); }}
                  onEndReachedThreshold={0.4}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => pickDrive(item)} activeOpacity={0.8} style={s.cell}>
                      {item.thumb ? (
                        <Image source={{ uri: item.thumb }} style={s.thumb} resizeMode="cover" />
                      ) : (
                        <View style={[s.thumb, s.fileThumb]}>
                          <Ionicons name={item.kind === 'video' ? 'videocam' : 'image'} size={24} color={C.muted} />
                        </View>
                      )}
                      {item.kind === 'video' ? (
                        <View style={s.playBadge}>
                          <Ionicons name="play" size={12} color="#fff" />
                        </View>
                      ) : null}
                      {downloading === item.id ? (
                        <View style={s.dlOverlay}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      ) : null}
                      <Text style={s.author} numberOfLines={1}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    !busy ? <Text style={s.empty}>{query ? 'No matches in this folder.' : 'No images or videos here yet.'}</Text> : null
                  }
                />
              ) : source === 'gphotos' ? (
                <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                  <Text style={[s.connectT, { marginTop: 0 }]}>Pick from Google Photos</Text>
                  <Text style={s.connectS}>Google shows its own picker — what you choose attaches here automatically.</Text>
                  <TouchableOpacity
                    onPress={() => void openPhotosPicker()}
                    disabled={picking}
                    activeOpacity={0.8}
                    style={s.connectBtn}
                  >
                    {picking ? (
                      <ActivityIndicator size="small" color={C.onInk} />
                    ) : (
                      <Text style={s.connectBtnT}>Open Google Picker</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={s.creditNote}>Only the photos you choose are ever shared.</Text>
                </View>
              ) : source === 'dropbox' ? (
                <FlatList
                  data={dbxFiles}
                  keyExtractor={(x) => x.path}
                  numColumns={3}
                  contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: 20 }}
                  columnWrapperStyle={{ gap: 8 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => pickDropbox(item)} activeOpacity={0.8} style={s.cell}>
                      {item.thumb ? (
                        <Image source={{ uri: item.thumb }} style={s.thumb} resizeMode="cover" />
                      ) : (
                        <View style={[s.thumb, s.fileThumb]}>
                          <Ionicons name={item.kind === 'video' ? 'videocam' : 'image'} size={24} color={C.muted} />
                        </View>
                      )}
                      {item.kind === 'video' ? (
                        <View style={s.playBadge}>
                          <Ionicons name="play" size={12} color="#fff" />
                        </View>
                      ) : null}
                      {downloading === item.path ? (
                        <View style={s.dlOverlay}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      ) : null}
                      <Text style={s.author} numberOfLines={1}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    !busy ? <Text style={s.empty}>{query ? 'No matches in your Dropbox.' : 'No images or videos in this folder.'}</Text> : null
                  }
                />
              ) : source === 'canva' ? (
                <FlatList
                  data={canvaDesigns}
                  keyExtractor={(x) => x.id}
                  numColumns={3}
                  contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: 20 }}
                  columnWrapperStyle={{ gap: 8 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => pickCanva(item)} activeOpacity={0.8} style={s.cell}>
                      {item.thumb ? (
                        <Image source={{ uri: item.thumb }} style={s.thumb} resizeMode="cover" />
                      ) : (
                        <View style={[s.thumb, s.fileThumb]}>
                          <Ionicons name="color-palette" size={24} color={C.muted} />
                        </View>
                      )}
                      {canvaKind === 'video' ? (
                        <View style={s.playBadge}>
                          <Ionicons name="play" size={12} color="#fff" />
                        </View>
                      ) : null}
                      {downloading === item.id ? (
                        <View style={s.dlOverlay}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      ) : null}
                      <Text style={s.author} numberOfLines={1}>{item.title}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    !busy ? <Text style={s.empty}>{query ? 'No matching designs.' : 'Your newest designs will appear here.'}</Text> : null
                  }
                />
              ) : (
                <FlatList
                  data={items}
                  keyExtractor={(x) => x.id}
                  numColumns={3}
                  contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: 20 }}
                  columnWrapperStyle={{ gap: 8 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => pick(item)} activeOpacity={0.8} style={s.cell}>
                      <Image source={{ uri: item.thumb }} style={s.thumb} resizeMode="cover" />
                      {item.kind === 'video' ? (
                        <View style={s.playBadge}>
                          <Ionicons name="play" size={12} color="#fff" />
                        </View>
                      ) : null}
                      {downloading === item.id ? (
                        <View style={s.dlOverlay}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      ) : null}
                      <Text style={s.author} numberOfLines={1}>{item.author}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    !busy ? <Text style={s.empty}>Search above to browse stock.</Text> : null
                  }
                />
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: C.ink },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.lineSoft },
  tileT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: C.ink },
  tileS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, marginTop: 2 },
  soonBadge: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.faint, borderWidth: 1, borderColor: C.lineSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sourceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  disconnectT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  backT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.accentInk },
  connectBox: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  connectT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: C.ink, textAlign: 'center' },
  connectS: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: C.muted, textAlign: 'center' },
  connectBtn: { backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 12, marginTop: 10 },
  connectBtnT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.onInk },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  search: { flex: 1, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.lineSoft, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: C.ink, fontFamily: 'PlusJakartaSans_400Regular' },
  go: { backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  goT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.onInk },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typePill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineSoft },
  typeT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: C.muted },
  creditNote: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: C.muted, marginBottom: 8 },
  folderChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 999, borderWidth: 1, borderColor: C.lineSoft, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 180 },
  folderT: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.ink, flexShrink: 1 },
  cell: { flex: 1 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: C.lineSoft },
  fileThumb: { alignItems: 'center', justifyContent: 'center' },
  playBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 4 },
  dlOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  author: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: C.muted, marginTop: 3 },
  empty: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: C.faint, textAlign: 'center', marginTop: 24 },
});
