'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  PaintBucket,
  Redo,
  Table as TableIcon,
  TextQuote,
  Type,
  Undo,
} from 'lucide-react';
import { createBlogExtensions } from '@/components/blog/tiptap';
import {
  normalizeInitialDoc,
  wordsOfTipTap,
  type TipTapDoc,
} from '@/lib/blogConvert';
import { EDITOR_THEMES, loadEditorTheme, saveEditorTheme, type EditorTheme } from '@/lib/editorTheme';

export type BlogDocChange = (doc: TipTapDoc, words: number) => void;

const SWATCHES = [
  '#FDF3D7',
  '#E4F2E5',
  '#EDE7FB',
  '#E3EDF9',
  '#FCE9DC',
  '#F9E4EC',
  '#1C1A14',
];

const RADII = ['0px', '8px', '16px', '24px'];

function TBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-1.5 text-xs font-bold transition ${
        active ? 'bg-ink text-paper' : 'text-soft hover:bg-paper-dim hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The TipTap surface inside the .doc-sheet. Same props as before: uploads go
 * to Supabase blog-media; every change hands the document JSON + word count
 * upward. Toolbar is Docs-style (static); a second row appears inside tables
 * with cell colors, corner radius and row/column tools.
 */
export default function BlogDoc({
  initial,
  onChange,
  onError,
}: {
  initial: unknown;
  onChange: BlogDocChange;
  onError: (msg: string) => void;
}) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [theme, setTheme] = useState<EditorTheme>(() => loadEditorTheme());

  const pickTheme = (t: EditorTheme) => {
    setTheme(t);
    saveEditorTheme(t);
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const cellFileRef = useRef<HTMLInputElement>(null);
  const errRef = useRef(onError);
  errRef.current = onError;

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const { createClient } = await import('@/lib/supabase/client');
    const sb = createClient();
    const ext =
      (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await sb.storage
      .from('blog-media')
      .upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (error) throw new Error(error.message);
    const { data } = sb.storage.from('blog-media').getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const editor = useEditor(
    {
      extensions: createBlogExtensions(uploadFile),
      content: normalizeInitialDoc(initial) as never,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: 'tiptap-doc' },
        handleDrop: (view, event) => {
          const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
            f.type.startsWith('image/'),
          );
          if (!files.length) return false;
          event.preventDefault();
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          void (async () => {
            try {
              for (const file of files) {
                const src = await uploadFile(file);
                view.dispatch(
                  view.state.tr.insert(
                    coords?.pos ?? view.state.selection.from,
                    view.state.schema.nodes.image.create({ src }),
                  ),
                );
              }
            } catch (e) {
              errRef.current(e instanceof Error ? e.message : 'Image upload failed.');
            }
          })();
          return true;
        },
        handlePaste: (view, event) => {
          const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
            f.type.startsWith('image/'),
          );
          if (!files.length) return false;
          event.preventDefault();
          void (async () => {
            try {
              for (const file of files) {
                const src = await uploadFile(file);
                view.dispatch(
                  view.state.tr.insert(
                    view.state.selection.from,
                    view.state.schema.nodes.image.create({ src }),
                  ),
                );
              }
            } catch (e) {
              errRef.current(e instanceof Error ? e.message : 'Image upload failed.');
            }
          })();
          return true;
        },
      },
      onUpdate: ({ editor: ed }) => {
        const doc = ed.getJSON() as unknown as TipTapDoc;
        onChange(doc, wordsOfTipTap(doc));
        force();
      },
      onSelectionUpdate: () => force(),
    },
    [uploadFile],
  );

  // Re-seed when the host swaps documents (edit another post/page).
  const initialKey = JSON.stringify(initial ?? null).slice(0, 64);
  useEffect(() => {
    if (!editor) return;
    const doc = normalizeInitialDoc(initial);
    editor.commands.setContent((doc ?? { type: 'doc', content: [{ type: 'paragraph' }] }) as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, initialKey]);

  if (!editor) return null;

  const pickImage = (intoCell: boolean) => {
    (intoCell ? cellFileRef : fileRef).current?.click();
  };

  const onImageFile = async (file: File | undefined, intoCell: boolean) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const src = await uploadFile(file);
      editor.chain().focus().setImage({ src }).run();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Image upload failed.');
    }
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Link URL (https://…)', prev ?? 'https://');
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: href.trim() }).run();
  };

  const setColor = (color: string | null) => {
    if (!color) {
      editor.chain().focus().unsetColor().run();
      return;
    }
    editor.chain().focus().setColor(color).run();
  };

  const inTable = editor.isActive('table');
  const cellBg = (editor.getAttributes('tableCell').backgroundColor as string | undefined) ??
    (editor.getAttributes('tableHeader').backgroundColor as string | undefined) ??
    null;

  return (
    <div className={`tiptap-wrap tiptap-theme-${theme}`}>
      {/* main toolbar */}
      <div className="tiptap-bar" role="toolbar" aria-label="Formatting">
        <TBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <span className="tiptap-sep" aria-hidden="true" />
        <TBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Body text">
          <Type className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <span className="tiptap-sep" aria-hidden="true" />
        <TBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={setLink} active={editor.isActive('link')} title="Link">
          <Link2 className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <label className="tiptap-color" title="Text color">
          <span className="tiptap-color-dot" style={{ background: (editor.getAttributes('textStyle').color as string | undefined) ?? '#1C1A14' }} aria-hidden="true" />
          <input
            type="color"
            className="hidden"
            value={(editor.getAttributes('textStyle').color as string | undefined) ?? '#1C1A14'}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Text color"
          />
        </label>
        <span className="tiptap-sep" aria-hidden="true" />
        <TBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
          <TextQuote className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <span className="tiptap-sep" aria-hidden="true" />
        <TBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
          <AlignLeft className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
          <AlignCenter className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
          <AlignRight className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
          <AlignJustify className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <span className="tiptap-sep" aria-hidden="true" />
        <TBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">
          <TableIcon className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => pickImage(false)} title="Insert image">
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().insertContent({ type: 'socialEmbed' }).run()} title="Social / video embed">
          <span className="text-[11px] font-extrabold">Embed</span>
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().insertContent({ type: 'chart' }).run()} title="Chart">
          <span className="text-[11px] font-extrabold">Chart</span>
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().insertContent({ type: 'buttonLink' }).run()} title="Button">
          <span className="text-[11px] font-extrabold">Button</span>
        </TBtn>
        <span className="flex-1" />
        <span className="tiptap-theme-switch" role="group" aria-label="Editor style">
          {EDITOR_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickTheme(t.id)}
              title={`${t.label} style`}
              aria-label={`${t.label} style`}
              aria-pressed={theme === t.id}
              className={`tiptap-theme-opt${theme === t.id ? ' tiptap-theme-on' : ''}`}
            >
              {t.id === 'document' ? (
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              ) : t.id === 'notion' ? (
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{t.label}</span>
            </button>
          ))}
        </span>
      </div>

      {/* table tools — only inside a table */}
      {inTable ? (
        <div className="tiptap-bar tiptap-bar-table" role="toolbar" aria-label="Table tools">
          <span className="tiptap-group-label">Cell</span>
          <span className="flex items-center gap-1" role="group" aria-label="Cell background">
            <PaintBucket className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', c).run()}
                title={`Cell color ${c}`}
                aria-label={`Cell color ${c}`}
                aria-pressed={cellBg === c}
                className={`h-5 w-5 rounded-full border transition ${cellBg === c ? 'border-ink ring-2 ring-ink/30' : 'border-line'}`}
                style={{ background: c }}
              />
            ))}
            <label title="Custom cell color" className="tiptap-color">
              <span className="tiptap-color-dot tiptap-color-custom" aria-hidden="true">+</span>
              <input
                type="color"
                className="hidden"
                value={cellBg && /^#[0-9a-fA-F]{6}$/.test(cellBg) ? cellBg : '#FDF3D7'}
                onChange={(e) => editor.chain().focus().setCellAttribute('backgroundColor', e.target.value).run()}
                aria-label="Custom cell color"
              />
            </label>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', null).run()}
              title="Clear cell color"
              className="rounded-md px-1.5 py-1 text-[11px] font-bold text-muted hover:text-ink"
            >
              Clear
            </button>
          </span>
          <span className="tiptap-sep" aria-hidden="true" />
          <span className="flex items-center gap-1" role="group" aria-label="Corner radius">
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().updateAttributes('table', { radius: r === '0px' ? null : r }).run()}
                title={`Corners ${r}`}
                aria-label={`Table corners ${r}`}
                className="rounded-md px-1.5 py-1 text-[11px] font-bold text-muted transition hover:text-ink"
              >
                {r.replace('px', '')}
              </button>
            ))}
          </span>
          <span className="tiptap-sep" aria-hidden="true" />
          <TBtn onClick={() => pickImage(true)} title="Image in this cell">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
          </TBtn>
          <TBtn onClick={() => editor.chain().focus().addRowBefore().run()} title="Add row above">
            <span className="text-[11px] font-extrabold">+R↑</span>
          </TBtn>
          <TBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row below">
            <span className="text-[11px] font-extrabold">+R↓</span>
          </TBtn>
          <TBtn onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add column left">
            <span className="text-[11px] font-extrabold">+C←</span>
          </TBtn>
          <TBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column right">
            <span className="text-[11px] font-extrabold">+C→</span>
          </TBtn>
          <TBtn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">
            <span className="text-[11px] font-extrabold">−R</span>
          </TBtn>
          <TBtn onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">
            <span className="text-[11px] font-extrabold">−C</span>
          </TBtn>
          <TBtn onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Toggle header row">
            <span className="text-[11px] font-extrabold">H</span>
          </TBtn>
          <TBtn onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">
            <span className="text-[11px] font-extrabold">Del</span>
          </TBtn>
        </div>
      ) : null}

      <EditorContent editor={editor} />

      {/* Floating format bar — follows the text selection so formatting never
          needs a scroll back to the top toolbar. */}
      <BubbleMenu
        editor={editor}
        shouldShow={({ state }) => {
          const { $from, $to } = state.selection;
          if ($from.pos === $to.pos) return false;
          const parent = $from.parent;
          return parent.type.name === 'paragraph' || parent.type.name === 'heading';
        }}
      >
        <div className="tiptap-bubble" role="toolbar" aria-label="Quick formatting">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" aria-label="Bold" className={`tbubble-btn${editor.isActive('bold') ? ' tbubble-on' : ''}`}>
            <Bold className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" aria-label="Italic" className={`tbubble-btn${editor.isActive('italic') ? ' tbubble-on' : ''}`}>
            <Italic className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={setLink} title="Link" aria-label="Link" className={`tbubble-btn${editor.isActive('link') ? ' tbubble-on' : ''}`}>
            <Link2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <label className="tbubble-btn" title="Text color" onMouseDown={(e) => e.preventDefault()}>
            <span className="tiptap-color-dot" style={{ background: (editor.getAttributes('textStyle').color as string | undefined) ?? '#FFFFFF', borderColor: 'rgba(255,255,255,0.4)' }} aria-hidden="true" />
            <input
              type="color"
              className="hidden"
              value={(editor.getAttributes('textStyle').color as string | undefined) ?? '#ffffff'}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Text color"
            />
          </label>
          <span className="tbubble-sep" aria-hidden="true" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1" aria-label="Heading 1" className={`tbubble-btn${editor.isActive('heading', { level: 1 }) ? ' tbubble-on' : ''}`}>
            <Heading1 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2" aria-label="Heading 2" className={`tbubble-btn${editor.isActive('heading', { level: 2 }) ? ' tbubble-on' : ''}`}>
            <Heading2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left" aria-label="Align left" className="tbubble-btn">
            <AlignLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center" aria-label="Align center" className="tbubble-btn">
            <AlignCenter className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right" aria-label="Align right" className="tbubble-btn">
            <AlignRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </BubbleMenu>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onImageFile(e.target.files?.[0], false);
          e.target.value = '';
        }}
      />
      <input
        ref={cellFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onImageFile(e.target.files?.[0], true);
          e.target.value = '';
        }}
      />
    </div>
  );
}
