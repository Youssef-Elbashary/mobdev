import { getCollection, type CollectionEntry } from 'astro:content';
import fs from 'node:fs';

/**
 * Data collections (YAML files) keep the order they're written in the file,
 * so reordering entries in the YAML reorders them on the site.
 */
const DATA_FILES = {
  commands: 'commands', roadmap: 'roadmap', troubleshooting: 'troubleshooting',
  resources: 'resources', extra: 'extra', checklist: 'checklist',
} as const;
type DataKey = keyof typeof DATA_FILES;
export async function getData<K extends DataKey>(name: K) {
  const entries = (await getCollection(name)) as CollectionEntry<K>[];
  let order: string[] = [];
  try {
    const src = fs.readFileSync(`./src/content/data/${DATA_FILES[name]}.yaml`, 'utf8');
    order = [...src.matchAll(/^- id:\s*['"]?([^'"\s]+)/gm)].map((m) => m[1]);
  } catch {}
  const ix = (id: string) => { const i = order.indexOf(id); return i === -1 ? 1e9 : i; };
  return entries.sort((a, b) => ix(a.id) - ix(b.id));
}

export const pad = (n: number) => String(n).padStart(2, '0');

export async function getLabs() {
  return (await getCollection('labs', (e) => !e.data.draft)).sort((a, b) => a.data.number - b.data.number);
}
export async function getCoursework() {
  return (await getCollection('coursework', (e) => !e.data.draft)).sort((a, b) => a.data.number - b.data.number);
}
export async function getTools() {
  return (await getCollection('tools')).sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name));
}
export async function getSetup() {
  return (await getCollection('setup')).sort((a, b) => a.data.step - b.data.step);
}
export async function getRoadmap() {
  return (await getCollection('roadmap')).sort((a, b) => a.data.order - b.data.order);
}
export async function getProject() {
  return (await getCollection('project'))[0] as CollectionEntry<'project'> | undefined;
}

/** Group items by a key, keeping first-seen order of keys. */
export function groupBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  items.forEach((i) => {
    const k = key(i);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(i);
  });
  return m;
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * Deadlines are shown exactly as written ("Week 6", "Week 12"…).
 * Only a real calendar date written as YYYY-MM-DD (e.g. 2026-11-12) is reformatted.
 * (Never pass free text to `new Date()`: it turns "Week 6" into "1 Jun 2001".)
 */
export function formatDeadline(d?: string) {
  if (!d) return 'TBA';
  const iso = d.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) return d;
  const date = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Tiny inline markdown for frontmatter strings: `code`, **bold**, [text](url). */
export function inline(s = '') {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/** Lightweight shell syntax highlighting for command strings. */
export function highlightCmd(cmd: string) {
  const out: string[] = [];
  const re = /(<[^>]+>)|("[^"]*"|'[^']*')|(\s--?[\w-]+(?:=[^\s]*)?)|(&&|\|\||\||>)|(\s+)|([^\s"'<]+)/g;
  let m: RegExpExecArray | null;
  let word = 0;
  while ((m = re.exec(cmd))) {
    const [tok, ph, str, flag, op, ws, w] = m;
    if (ph) out.push(`<span class="tok-ph">${esc(ph)}</span>`);
    else if (str) out.push(`<span class="tok-str">${esc(str)}</span>`);
    else if (flag) out.push(`<span class="tok-flag">${esc(flag)}</span>`);
    else if (op) { out.push(`<span class="tok-op">${esc(op)}</span>`); word = 0; }
    else if (ws) out.push(ws);
    else if (w) { out.push(word === 0 ? `<span class="tok-cmd">${esc(w)}</span>` : word === 1 && /^[a-z][\w-]*$/.test(w) ? `<span class="tok-sub">${esc(w)}</span>` : esc(w)); word++; }
    else out.push(esc(tok));
  }
  return out.join('');
}
