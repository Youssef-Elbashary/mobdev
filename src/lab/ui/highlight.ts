/** Syntax colours shared by the editor and static code (predict / order exercises). Colours are CSS variables. */
import { HighlightStyle } from '@codemirror/language';
import { highlightCode, tags as t } from '@lezer/highlight';
import { tsxLanguage } from '@codemirror/lang-javascript';
import { StyleModule } from 'style-mod';
import { esc } from './dom.ts';

export const labHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword], color: 'var(--cm-kw)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--cm-str)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--cm-com)', fontStyle: 'italic' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--cm-num)' },
  { tag: [t.tagName, t.standard(t.tagName)], color: 'var(--cm-tag)' },
  { tag: t.attributeName, color: 'var(--cm-attr)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--cm-fn)' },
  { tag: [t.typeName, t.className], color: 'var(--cm-type)' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: 'var(--cm-prop)' },
  { tag: [t.operator, t.punctuation, t.bracket, t.angleBracket, t.separator], color: 'var(--cm-punc)' },
  { tag: [t.variableName, t.definition(t.variableName)], color: 'var(--cm-var)' },
]);

let mounted = false;
/** Static, read-only highlighted HTML for a code snippet. */
export function highlightHTML(code: string): string {
  if (!mounted && labHighlight.module) {
    StyleModule.mount(document, labHighlight.module);
    mounted = true;
  }
  const tree = tsxLanguage.parser.parse(code);
  let html = '';
  highlightCode(
    code,
    tree,
    labHighlight,
    (text, classes) => {
      html += classes ? `<span class="${classes}">${esc(text)}</span>` : esc(text);
    },
    () => {
      html += '\n';
    },
  );
  return html;
}
