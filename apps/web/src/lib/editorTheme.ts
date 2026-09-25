/**
 * Editor visual theme preference (blog + page editors). Pure preference —
 * it never touches the document or the published output.
 */
export type EditorTheme = 'document' | 'notion' | 'minimal';

const KEY = 'sosial-editor-theme-v1';

export const EDITOR_THEMES: { id: EditorTheme; label: string }[] = [
  { id: 'document', label: 'Document' },
  { id: 'notion', label: 'Notion' },
  { id: 'minimal', label: 'Minimal' },
];

export function loadEditorTheme(): EditorTheme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'notion' || v === 'minimal' || v === 'document') return v;
  } catch {
    /* private mode / SSR — fall through to the default */
  }
  return 'document';
}

export function saveEditorTheme(theme: EditorTheme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* preference just won't persist */
  }
}
