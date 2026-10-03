/**
 * The code editor (CodeMirror 6): TSX highlighting, curated autocomplete, auto-closing brackets and
 * JSX tags, error underlines. One EditorView per workbench; each file keeps its own state (undo history).
 */
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, highlightSpecialChars,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript, localCompletionSource, snippets } from '@codemirror/lang-javascript';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, completeFromList } from '@codemirror/autocomplete';
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, setDiagnostics, type Diagnostic as CMDiagnostic } from '@codemirror/lint';
import { labCompletions } from './completions.ts';
import { labHighlight } from './highlight.ts';
import type { Frame } from '../runtime/protocol.ts';

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13.5px', backgroundColor: 'var(--code-bg)', color: 'var(--text)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6', overflow: 'auto' },
  '.cm-content': { padding: '12px 0', caretColor: 'var(--accent-text)' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--text-3)', border: 'none', paddingLeft: '6px' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-2)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--text) 4%, transparent)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent-text)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in oklab, var(--info) 28%, transparent) !important' },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in oklab, var(--accent) 22%, transparent)', outline: 'none' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: '10px', boxShadow: 'var(--shadow-md)', color: 'var(--text)', overflow: 'hidden' },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', fontSize: '12.5px', maxHeight: '15em' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '3px 10px 3px 6px', lineHeight: '1.5' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--text)' },
  '.cm-completionDetail': { color: 'var(--text-3)', fontStyle: 'normal', marginLeft: '10px', fontSize: '11.5px' },
  '.cm-completionInfo': { padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: '12.5px', maxWidth: '260px' },
  '.cm-completionMatchedText': { textDecoration: 'none', color: 'var(--accent-text)', fontWeight: '700' },
  '.cm-completionIcon': { opacity: '0.6' },
  '.cm-diagnostic': { fontFamily: 'var(--font-body)', fontSize: '12.5px', padding: '6px 10px' },
  '.cm-diagnostic-error': { borderLeft: '3px solid var(--danger)' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--danger)', textUnderlineOffset: '3px' },
  '.cm-gutter-lint': { width: '12px' },
  '.cm-lint-marker': { width: '10px', height: '10px' },
  '.cm-snippetField': { backgroundColor: 'color-mix(in oklab, var(--accent) 14%, transparent)' },
});

export type EditorDiagnostic = { line: number; column?: number; message: string; severity?: 'error' | 'warning' };

export function createEditor(opts: {
  parent: HTMLElement;
  frame: Frame;
  /** all files' code joined (so autocomplete knows the student's components) */
  allCode: () => string;
  onChange: () => void;
}) {
  const extensions = (readOnly: boolean): Extension[] => [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    indentUnit.of('  '),
    EditorState.tabSize.of(2),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    javascript({ jsx: true, typescript: true }),
    syntaxHighlighting(labHighlight),
    autocompletion({
      override: [labCompletions(opts.frame, opts.allCode), localCompletionSource, completeFromList(snippets)],
      icons: true,
      activateOnTypingDelay: 60,
    }),
    lintGutter(),
    keymap.of([...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
    theme,
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.contentAttributes.of({ 'aria-label': 'Code editor', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) opts.onChange();
    }),
  ];

  const states = new Map<string, EditorState>();
  let current = '';
  const view = new EditorView({ parent: opts.parent, state: EditorState.create({ doc: '', extensions: extensions(false) }) });

  return {
    view,
    /** register a file (keeps its own undo history) */
    addFile(path: string, doc: string, readOnly = false) {
      states.set(path, EditorState.create({ doc, extensions: extensions(readOnly) }));
    },
    show(path: string) {
      if (current) states.set(current, view.state);
      const state = states.get(path);
      if (!state) return;
      current = path;
      view.setState(state);
    },
    get current() {
      return current;
    },
    read(path: string): string {
      if (path === current) return view.state.doc.toString();
      return states.get(path)?.doc.toString() ?? '';
    },
    replace(path: string, doc: string) {
      const readOnly = (path === current ? view.state : states.get(path))?.readOnly ?? false;
      const fresh = EditorState.create({ doc, extensions: extensions(readOnly) });
      states.set(path, fresh);
      if (path === current) view.setState(fresh);
    },
    /** show errors for the open file (1-based lines) */
    diagnose(list: EditorDiagnostic[]) {
      const doc = view.state.doc;
      const marks: CMDiagnostic[] = list
        .filter((d) => d.line >= 1 && d.line <= doc.lines)
        .map((d) => {
          const line = doc.line(d.line);
          const indent = line.text.length - line.text.trimStart().length;
          return { from: line.from + indent, to: line.to, severity: d.severity ?? 'error', message: d.message };
        });
      view.dispatch(setDiagnostics(view.state, marks));
    },
    focus() {
      view.focus();
    },
    destroy() {
      view.destroy();
    },
  };
}

export type LabEditor = ReturnType<typeof createEditor>;
