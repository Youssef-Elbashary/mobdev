/** CodeMirror 6, themed with the site's tokens (works in dark and light). Loaded lazily. */
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';

const theme = EditorView.theme({
  '&': { color: 'var(--text)', backgroundColor: 'var(--code-bg)', fontSize: '13px', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7' },
  '.cm-content': { caretColor: 'var(--accent-text)', padding: '12px 0' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--text-3)', border: 'none', paddingLeft: '6px' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--accent) 5%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-2)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in oklab, var(--accent) 24%, transparent) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--accent-text)', borderLeftWidth: '2px' },
  '.cm-matchingBracket': { backgroundColor: 'var(--accent-soft)', outline: '1px solid var(--line-2)' },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword], color: 'var(--pg-kw)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--pg-str)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--pg-num)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--text-3)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--pg-fn)' },
  { tag: [t.typeName, t.className, t.tagName, t.standard(t.tagName)], color: 'var(--pg-tag)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--pg-attr)' },
]);

export type Editor = { view: EditorView; setDoc(doc: string): void };

export function createEditor(parent: HTMLElement, doc: string, opts: { label: string; onChange(doc: string): void; onRun(): void }): Editor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        javascript({ jsx: true, typescript: true }),
        syntaxHighlighting(highlight),
        theme,
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
        keymap.of([{ key: 'Mod-Enter', run: () => (opts.onRun(), true) }, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) opts.onChange(u.state.doc.toString());
        }),
        EditorView.contentAttributes.of({ 'aria-label': opts.label }),
      ],
    }),
  });
  return { view, setDoc: (d) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: d } }) };
}
