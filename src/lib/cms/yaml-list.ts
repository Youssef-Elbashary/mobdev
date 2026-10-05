/**
 * Edits the YAML data files (a top-level list of `- id: …` entries) without disturbing anything else:
 * only the edited entry's text is regenerated, every other byte — comments, blank lines, quoting,
 * `[flow, lists]` — stays exactly as written. Line endings (LF / CRLF) are kept.
 */
import { Document, isMap, isScalar, isSeq, parseDocument, type Node, type YAMLMap, type YAMLSeq } from 'yaml';

export type Entry = { id: string; value: Record<string, unknown> };
const OPTS = { lineWidth: 0, flowCollectionPadding: false } as const;

const eolOf = (src: string) => (src.includes('\r\n') ? '\r\n' : '\n');
const toLf = (src: string) => src.replace(/\r\n/g, '\n');
const withEol = (src: string, eol: string) => (eol === '\n' ? src : src.replace(/\n/g, eol));

function load(src: string) {
  const text = toLf(src);
  const doc = parseDocument(text);
  if (doc.errors.length) throw new Error(`YAML error: ${doc.errors[0].message}`);
  if (!isSeq(doc.contents)) throw new Error('Expected a list of entries.');
  return { text, doc, seq: doc.contents as YAMLSeq };
}

const idOf = (item: unknown) => (isMap(item) ? String((item as YAMLMap).get('id') ?? '') : '');

export function listEntries(src: string): Entry[] {
  const { seq } = load(src);
  return seq.items.map((item) => {
    const { id, ...value } = (item as Node).toJSON() as Record<string, unknown>;
    return { id: String(id), value };
  });
}

/** Where an entry's own text is: from the start of its "- " line to the end of its last value line. */
function span(text: string, item: YAMLMap) {
  const [start, valueEnd] = item.range!;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nl = text.indexOf('\n', valueEnd - 1);
  return { from: lineStart, to: nl === -1 ? text.length : nl + 1, indent: start - lineStart };
}

/** Renders one entry as a "- key: value" block. Lists of plain values are written [inline, like, this]. */
function render(value: Record<string, unknown>, keepFrom?: YAMLMap, indent = 2): string {
  const doc = new Document(keepFrom ? keepFrom.clone() : value);
  if (keepFrom) {
    const map = doc.contents as YAMLMap;
    for (const key of Object.keys(value)) {
      const old = map.get(key, true) as Node | undefined;
      const same = old && JSON.stringify(old.toJSON()) === JSON.stringify(value[key]);
      if (!same) map.set(key, doc.createNode(value[key]));
    }
    for (const pair of [...map.items]) {
      const key = String(isScalar(pair.key) ? pair.key.value : pair.key);
      if (!(key in value)) map.delete(key);
    }
    map.commentBefore = undefined;
  }
  // house style: short lists of strings/numbers stay on one line
  const walk = (node: unknown) => {
    if (isSeq(node)) {
      if (node.items.every((i) => isScalar(i))) node.flow = true;
      node.items.forEach(walk);
    } else if (isMap(node)) node.items.forEach((p) => walk(p.value));
  };
  walk(doc.contents);
  const lines = doc.toString(OPTS).replace(/\n$/, '').split('\n');
  const pad = ' '.repeat(Math.max(0, indent - 2));
  return lines.map((l, k) => (k === 0 ? `${pad}- ${l}` : `${pad}  ${l}`)).join('\n') + '\n';
}

const orderedValue = (id: string, value: Record<string, unknown>): Record<string, unknown> => {
  const { id: _ignored, ...rest } = value;
  return { id, ...rest };
};

/** Renders one `key: value` block at a given indent (new values get the house style). */
function renderPair(key: string, value: unknown, indent: number): string {
  const doc = new Document({ [key]: value });
  const walk = (node: unknown) => {
    if (isSeq(node)) {
      if (node.items.every((i) => isScalar(i))) node.flow = true;
      node.items.forEach(walk);
    } else if (isMap(node)) node.items.forEach((p) => walk(p.value));
  };
  walk(doc.contents);
  const pad = ' '.repeat(indent);
  return doc.toString(OPTS).replace(/\n$/, '').split('\n').map((l) => pad + l).join('\n') + '\n';
}

/**
 * Field-level edit: only the `key: value` lines that changed are rewritten;
 * untouched fields keep their exact text (quotes, `{ flow }` maps, block lists, comments).
 */
export function setEntry(src: string, id: string, value: Record<string, unknown>): string {
  const eol = eolOf(src);
  const { text, seq } = load(src);
  const item = seq.items.find((i) => idOf(i) === id) as YAMLMap | undefined;
  if (!item) throw new Error(`No entry with id "${id}".`);
  const next = orderedValue(id, value);
  const edits: { from: number; to: number; text: string }[] = [];
  let lastEnd = span(text, item).to;
  let keyIndent = span(text, item).indent;
  for (const pair of item.items) {
    const key = String(isScalar(pair.key) ? pair.key.value : pair.key);
    const keyNode = pair.key as Node;
    const valNode = pair.value as Node | null;
    const lineStart = text.lastIndexOf('\n', keyNode.range![0] - 1) + 1;
    const end = valNode?.range ? valNode.range[1] : keyNode.range![1];
    const nl = text.indexOf('\n', Math.max(end - 1, keyNode.range![0]));
    const lineEnd = nl === -1 ? text.length : nl + 1;
    const isFirst = pair === item.items[0];
    keyIndent = keyNode.range![0] - lineStart - (isFirst ? 2 : 0);
    lastEnd = lineEnd;
    if (!(key in next)) {
      if (!isFirst) edits.push({ from: lineStart, to: lineEnd, text: '' });
      continue;
    }
    const before = valNode && typeof valNode.toJSON === 'function' ? valNode.toJSON() : valNode;
    if (JSON.stringify(before ?? null) === JSON.stringify(next[key] ?? null)) continue;
    const block = renderPair(key, next[key], keyIndent);
    // the first key shares its line with the "- " marker
    edits.push({ from: lineStart, to: lineEnd, text: isFirst ? text.slice(lineStart, keyNode.range![0]) + block.trimStart() : block });
  }
  const existing = new Set(item.items.map((p) => String(isScalar(p.key) ? p.key.value : p.key)));
  const added = Object.keys(next).filter((k) => !existing.has(k) && next[k] !== undefined);
  if (added.length) edits.push({ from: lastEnd, to: lastEnd, text: added.map((k) => renderPair(k, next[k], keyIndent)).join('') });
  let out = text;
  for (const e of edits.sort((a, b) => b.from - a.from)) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  return withEol(out, eol);
}

export function addEntry(src: string, value: Record<string, unknown>, afterId?: string): string {
  const eol = eolOf(src);
  const { text, seq } = load(src);
  const id = String(value.id ?? '');
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) throw new Error('The id may only use letters, numbers and hyphens.');
  if (seq.items.some((i) => idOf(i) === id)) throw new Error(`An entry with id "${id}" already exists.`);
  const after = afterId ? (seq.items.find((i) => idOf(i) === afterId) as YAMLMap | undefined) : (seq.items[seq.items.length - 1] as YAMLMap | undefined);
  const indent = after ? span(text, after).indent : 2;
  const block = render(orderedValue(id, value), undefined, indent);
  if (!after) return withEol(text.replace(/\n*$/, '\n') + block, eol);
  const at = span(text, after).to;
  const glue = at === text.length && !text.endsWith('\n') ? '\n' : '';
  return withEol(text.slice(0, at) + glue + block + text.slice(at), eol);
}

export function removeEntry(src: string, id: string): string {
  const eol = eolOf(src);
  const { text, seq } = load(src);
  const item = seq.items.find((i) => idOf(i) === id) as YAMLMap | undefined;
  if (!item) throw new Error(`No entry with id "${id}".`);
  const { from, to } = span(text, item);
  return withEol(text.slice(0, from) + text.slice(to), eol);
}

export function moveEntry(src: string, id: string, toIndex: number): string {
  const eol = eolOf(src);
  const { text, seq } = load(src);
  const index = seq.items.findIndex((i) => idOf(i) === id);
  if (index === -1) throw new Error(`No entry with id "${id}".`);
  const target = Math.max(0, Math.min(seq.items.length - 1, toIndex));
  if (target === index) return src;
  const { from, to } = span(text, seq.items[index] as YAMLMap);
  const block = text.slice(from, to);
  const without = text.slice(0, from) + text.slice(to);
  const rest = load(without).seq.items as YAMLMap[];
  // moving down: insert after the entry now at `target - 1`… which is rest[target - 1]; moving up: before rest[target]
  let at: number;
  if (target >= rest.length) at = span(without, rest[rest.length - 1]).to;
  else if (target > index) at = span(without, rest[target - 1]).to;
  else at = span(without, rest[target]).from;
  return withEol(without.slice(0, at) + block + without.slice(at), eol);
}

/** site.yaml is a map document: set the changed values, keep comments. */
export function setSite(src: string, value: Record<string, unknown>): string {
  const eol = eolOf(src);
  const doc = parseDocument(toLf(src));
  if (doc.errors.length) throw new Error(`YAML error: ${doc.errors[0].message}`);
  const sync = (path: (string | number)[], next: unknown) => {
    const current = doc.getIn(path, true) as Node | undefined;
    const before = current && typeof (current as Node).toJSON === 'function' ? (current as Node).toJSON() : current;
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    if (next && typeof next === 'object' && !Array.isArray(next) && isMap(current)) {
      for (const [k, v] of Object.entries(next)) sync([...path, k], v);
      return;
    }
    doc.setIn(path, doc.createNode(next));
  };
  for (const [k, v] of Object.entries(value)) sync([k], v);
  return withEol(doc.toString(OPTS), eol);
}
