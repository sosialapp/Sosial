'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  TextQuote,
} from 'lucide-react';
import { ResizableImage } from '@/components/blog/tiptap';
import { normalizeInitialDoc, wordsOfTipTap, type TipTapDoc } from '@/lib/blogConvert';

/**
 * Focused long-form editor for website channels (WordPress, Ghost, Dev.to,
 * Hashnode). A slim subset of the blog editor: headings, inline marks, lists,
 * quotes, code, links, dividers and images — the exact node set the article
 * serializer (`lib/article.ts`) renders to HTML and Markdown. The document is
 * handed upward as TipTap JSON on every change; persistence happens per target.
 */
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
        active ? 'bg-ink text-paper' : 'text-muted hover:bg-paper-dim hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export default function ArticleEditor({
  initial,
  onChange,
}: {
  initial: TipTapDoc | null;
  onChange: (doc: TipTapDoc, words: number) => void;
}) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ link: false, heading: { levels: [2, 3] } }),
        Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
        ResizableImage.configure({ inline: false, allowBase64: false }),
        Placeholder.configure({ placeholder: 'Write your article…' }),
      ],
      content: normalizeInitialDoc(initial) as never,
      immediatelyRender: false,
      editorProps: { attributes: { class: 'tiptap-doc' } },
      onUpdate: ({ editor: ed }) => {
        const doc = ed.getJSON() as unknown as TipTapDoc;
        onChange(doc, wordsOfTipTap(doc));
      },
    },
    [],
  );

  if (!editor) return null;

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

  const addImage = () => {
    const src = window.prompt('Image URL (https://…)');
    if (!src || !src.trim()) return;
    editor.chain().focus().setImage({ src: src.trim() }).run();
  };

  return (
    <div className="doc-sheet blog-doc">
      <div
        className="flex flex-wrap items-center gap-0.5 rounded-2xl border border-line bg-paper-dim p-1.5"
        role="toolbar"
        aria-label="Article formatting"
      >
        <TBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
        <TBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn onClick={setLink} active={editor.isActive('link')} title="Link">
          <Link2 className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
        <TBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          <TextQuote className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Code block"
        >
          <Code className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
        <TBtn onClick={addImage} title="Insert image">
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Divider"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </TBtn>
      </div>

      <div className="mt-2 rounded-2xl border border-line bg-paper px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
