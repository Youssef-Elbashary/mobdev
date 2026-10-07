/**
 * MODULE PLATFORM — rules. Modules and their labs are authored in the node builder (/admin/builder) as
 * flows: nodes on a canvas joined by edges, read in order from the Start node. A lab flow compiles into
 * the same building blocks the file-based labs use (Part, Task, Playground exercise, Checkpoint, Terminal,
 * Repo submit, Check-in), plus an outline in MDX syntax that the progress tracker already understands,
 * so attendance, sessions, Done ticks, graded exercises and the admin dashboards work unchanged.
 * Pure functions only, so they are unit-tested (tests/platform.test.ts) and shared with the builder UI.
 */
import type { Check, Step } from '../../runner/protocol';

/* --------------------------------------------------------------- node types */

export type FieldKind = 'text' | 'textarea' | 'markdown' | 'code' | 'number' | 'select' | 'lines' | 'checks' | 'color';
export type Field = { key: string; label: string; kind: FieldKind; options?: string[]; placeholder?: string; help?: string; max?: number };
export type NodeDef = {
  label: string;
  /** one-line description in the palette */
  hint: string;
  /** accent colour of the node header */
  color: string;
  /** short glyph shown on the node */
  glyph: string;
  fields: Field[];
  defaults: Record<string, string>;
  /** the root node: exactly one, cannot be deleted, has no input */
  root?: boolean;
  /** cannot be followed by anything (e.g. the module node is only a root) */
  terminal?: boolean;
};

export const LAB_NODES = {
  start: {
    label: 'Lab', hint: 'Lab title, summary and difficulty', color: '#c8ff4d', glyph: '▶', root: true,
    fields: [
      { key: 'title', label: 'Lab title', kind: 'text', max: 120 },
      { key: 'description', label: 'Summary', kind: 'textarea', max: 400 },
      { key: 'difficulty', label: 'Difficulty', kind: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
      { key: 'estimatedTime', label: 'Estimated time', kind: 'text', placeholder: '2 hours', max: 40 },
      { key: 'objectives', label: 'Learning objectives', kind: 'lines', help: 'One per line', max: 2000 },
    ],
    defaults: { title: 'New lab', description: '', difficulty: 'Beginner', estimatedTime: '2 hours', objectives: '' },
  },
  part: {
    label: 'Part', hint: 'Big numbered section', color: '#7cb1ff', glyph: '§',
    fields: [{ key: 'title', label: 'Title', kind: 'text', max: 120 }, { key: 'time', label: 'Time', kind: 'text', placeholder: '20 min', max: 20 }],
    defaults: { title: 'New part', time: '20 min' },
  },
  task: {
    label: 'Task', hint: 'Task card with a Done tick (tracked)', color: '#5ee0d2', glyph: '✓',
    fields: [
      { key: 'title', label: 'Title', kind: 'text', max: 120 },
      { key: 'time', label: 'Time', kind: 'text', placeholder: '5 min', max: 20 },
      { key: 'body', label: 'Instructions', kind: 'markdown', max: 20000 },
    ],
    defaults: { title: 'New task', time: '5 min', body: 'Describe what the student should do.' },
  },
  text: {
    label: 'Text', hint: 'Markdown paragraph, list, table…', color: '#b8c0cc', glyph: '¶',
    fields: [{ key: 'body', label: 'Markdown', kind: 'markdown', max: 20000 }],
    defaults: { body: 'Write some **markdown** here.' },
  },
  callout: {
    label: 'Callout', hint: 'Note, tip, warning or caution box', color: '#ffb547', glyph: '!',
    fields: [
      { key: 'tone', label: 'Tone', kind: 'select', options: ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] },
      { key: 'body', label: 'Text', kind: 'markdown', max: 4000 },
    ],
    defaults: { tone: 'TIP', body: 'A helpful tip.' },
  },
  checkpoint: {
    label: 'Checkpoint', hint: '“You should now see…” box', color: '#1d8a4a', glyph: '◉',
    fields: [{ key: 'body', label: 'What they should see', kind: 'markdown', max: 4000 }],
    defaults: { body: 'You should now see …' },
  },
  code: {
    label: 'Code', hint: 'Highlighted code block with copy button', color: '#ff8ad8', glyph: '{}',
    fields: [
      { key: 'title', label: 'File name', kind: 'text', placeholder: 'App.tsx', max: 80 },
      { key: 'lang', label: 'Language', kind: 'select', options: ['tsx', 'ts', 'js', 'jsx', 'json', 'bash', 'powershell', 'kotlin', 'swift', 'dart', 'python', 'java', 'html', 'css', 'yaml', 'text'] },
      { key: 'code', label: 'Code', kind: 'code', max: 20000 },
    ],
    defaults: { title: '', lang: 'tsx', code: "export default function App() {\n  return null;\n}" },
  },
  terminal: {
    label: 'Terminal', hint: 'Commands and their output', color: '#8a93a1', glyph: '$',
    fields: [{ key: 'lines', label: 'Lines', kind: 'lines', help: '$ command · # comment · > highlight · other lines are output', max: 4000 }],
    defaults: { lines: '$ npx create-expo-app@latest my-app\n# creates the project folder\n> ✔ Your project is ready!' },
  },
  exercise: {
    label: 'Exercise', hint: 'Live React Native editor, auto-graded', color: '#b69cff', glyph: '⚡',
    fields: [
      { key: 'title', label: 'Title', kind: 'text', max: 120 },
      { key: 'goal', label: 'Goal', kind: 'markdown', max: 2000 },
      { key: 'hint', label: 'Hint', kind: 'textarea', max: 1000 },
      { key: 'starter', label: 'Starter App.tsx', kind: 'code', max: 30000 },
      { key: 'solution', label: 'Solution App.tsx', kind: 'code', max: 30000 },
      { key: 'checks', label: 'Checks', kind: 'checks', max: 4000,
        help: 'One check per line: name :: step; step … Steps: press +, type Ali into Name, expect 1, expect exact 1, not Error, code /useState/ uses useState, wait 300' },
    ],
    defaults: {
      title: 'Counter',
      goal: 'Make the **+** button add 1.',
      hint: 'Call `setCount(count + 1)` in `onPress`.',
      starter: "import { useState } from 'react';\nimport { View, Text, Pressable } from 'react-native';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>\n      <Text style={{ fontSize: 48 }}>{count}</Text>\n      {/* TODO: make this add 1 */}\n      <Pressable onPress={() => {}}><Text style={{ fontSize: 32 }}>+</Text></Pressable>\n    </View>\n  );\n}\n",
      solution: "import { useState } from 'react';\nimport { View, Text, Pressable } from 'react-native';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>\n      <Text style={{ fontSize: 48 }}>{count}</Text>\n      <Pressable onPress={() => setCount(count + 1)}><Text style={{ fontSize: 32 }}>+</Text></Pressable>\n    </View>\n  );\n}\n",
      checks: 'Starts at 0 :: expect exact 0\n+ adds 1 :: press +; expect exact 1',
    },
  },
  repo: {
    label: 'Repo link', hint: 'Students submit their GitHub link (tracked)', color: '#ff7a6b', glyph: '⎇',
    fields: [], defaults: {},
  },
  checkin: {
    label: 'Check-in', hint: 'End-of-lab attendance card', color: '#c8ff4d', glyph: '⌖', terminal: true,
    fields: [], defaults: {},
  },
} as const satisfies Record<string, NodeDef>;

export const MODULE_NODES = {
  module: {
    label: 'Module', hint: 'Code, title, term and colour', color: '#c8ff4d', glyph: '◆', root: true,
    fields: [
      { key: 'code', label: 'Module code', kind: 'text', placeholder: '25CSCI40H', max: 20 },
      { key: 'title', label: 'Title', kind: 'text', max: 120 },
      { key: 'term', label: 'Term', kind: 'text', placeholder: '2026–2027 · Semester One', max: 60 },
      { key: 'description', label: 'Description', kind: 'textarea', max: 600 },
      { key: 'color', label: 'Accent colour', kind: 'color' },
      { key: 'leader', label: 'Module leader (doctor email)', kind: 'text', placeholder: 'name@bue.edu.eg', max: 200, help: 'Only this doctor sets the assessment (weights, components). Their doctor account must use this email.' },
      { key: 'category', label: 'Category', kind: 'select', options: ['Core', 'Optional'], help: 'Core: shown to every student in the years/specializations below. Optional: only to students who chose it.' },
      { key: 'years', label: 'Years', kind: 'text', placeholder: 'Year 3, Year 4', help: 'Comma-separated; empty = every year', max: 200 },
      { key: 'semester', label: 'Semester', kind: 'select', options: ['Semester 1', 'Semester 2', 'Both'], help: 'Students see the active semester’s modules first (the admin switches the active semester).' },
      { key: 'specializations', label: 'Specializations', kind: 'text', placeholder: 'Software Engineering, Artificial Intelligence', help: 'Comma-separated; empty = every specialization', max: 600 },
    ],
    defaults: { code: '', title: 'New module', term: '', description: '', color: '#7cb1ff', leader: '', category: 'Core', years: '', semester: 'Semester 1', specializations: '' },
  },
  lab: {
    label: 'Lab', hint: 'A lab of this module (double-click to build it)', color: '#7cb1ff', glyph: '⚗',
    fields: [{ key: 'slug', label: 'Lab', kind: 'text', help: 'Linked lab (set automatically)', max: 60 }],
    defaults: { slug: '' },
  },
  divider: {
    label: 'Week', hint: 'Label that groups the labs after it', color: '#8a93a1', glyph: '#',
    fields: [{ key: 'title', label: 'Label', kind: 'text', placeholder: 'Week 3', max: 60 }],
    defaults: { title: 'Week 1' },
  },
} as const satisfies Record<string, NodeDef>;

export type LabNodeType = keyof typeof LAB_NODES;
export type ModuleNodeType = keyof typeof MODULE_NODES;
export type FlowKind = 'lab' | 'module';
export const nodeDefs = (kind: FlowKind): Record<string, NodeDef> => (kind === 'lab' ? LAB_NODES : MODULE_NODES);

/* --------------------------------------------------------------------- flows */

export type FlowNode = { id: string; type: string; x: number; y: number; data: Record<string, string> };
export type FlowEdge = { from: string; to: string };
export type Flow = { nodes: FlowNode[]; edges: FlowEdge[] };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_NODES = 300;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

/** "Web Development 2!" → "web-development-2" */
export const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '') || 'item';

/** A starter flow: just the root node. */
export function emptyFlow(kind: FlowKind, data: Record<string, string> = {}): Flow {
  const type = kind === 'lab' ? 'start' : 'module';
  const def = nodeDefs(kind)[type];
  return { nodes: [{ id: 'root', type, x: 80, y: 120, data: { ...def.defaults, ...data } }], edges: [] };
}

/**
 * Validates and cleans a flow from the builder: known node types, bounded text, finite positions,
 * exactly one root, edges between existing nodes, at most one outgoing and one incoming edge per node
 * (a flow is a chain), no edge into the root and no self-loops.
 */
export function sanitizeFlow(input: unknown, kind: FlowKind): Result<Flow> {
  const defs = nodeDefs(kind);
  const raw = (input && typeof input === 'object' ? input : {}) as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(raw.nodes)) return { ok: false, error: 'The flow has no nodes.' };
  if (raw.nodes.length > MAX_NODES) return { ok: false, error: `A flow can have at most ${MAX_NODES} nodes.` };
  const nodes: FlowNode[] = [];
  const seen = new Set<string>();
  for (const n of raw.nodes as Record<string, unknown>[]) {
    const id = String(n?.id ?? '');
    const type = String(n?.type ?? '');
    const def = defs[type];
    if (!ID_RE.test(id) || seen.has(id)) return { ok: false, error: 'A node has a missing or duplicate id.' };
    if (!def) return { ok: false, error: `Unknown node type “${type}”.` };
    seen.add(id);
    const data: Record<string, string> = {};
    const src = (n.data && typeof n.data === 'object' ? n.data : {}) as Record<string, unknown>;
    for (const f of def.fields) {
      const v = typeof src[f.key] === 'string' ? (src[f.key] as string) : def.defaults[f.key] ?? '';
      if (f.max && v.length > f.max) return { ok: false, error: `“${f.label}” in a ${def.label} node is longer than ${f.max} characters.` };
      if (f.kind === 'select' && f.options && !f.options.includes(v)) data[f.key] = def.defaults[f.key] ?? f.options[0];
      else if (f.kind === 'color') data[f.key] = /^#[0-9a-f]{6}$/i.test(v) ? v : def.defaults[f.key] ?? '#7cb1ff';
      else data[f.key] = v;
    }
    const pos = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(-20000, Math.min(20000, Math.round(Number(v)))) : 0);
    nodes.push({ id, type, x: pos(n.x), y: pos(n.y), data });
  }
  const roots = nodes.filter((n) => defs[n.type].root);
  if (roots.length !== 1) return { ok: false, error: `A flow needs exactly one ${kind === 'lab' ? 'Lab' : 'Module'} node.` };

  const edges: FlowEdge[] = [];
  const out = new Set<string>();
  const into = new Set<string>();
  for (const e of Array.isArray(raw.edges) ? (raw.edges as Record<string, unknown>[]) : []) {
    const from = String(e?.from ?? '');
    const to = String(e?.to ?? '');
    const a = nodes.find((n) => n.id === from);
    const b = nodes.find((n) => n.id === to);
    if (!a || !b || from === to || defs[b.type].root || defs[a.type].terminal) continue;
    if (out.has(from) || into.has(to)) continue; // a chain: one way out, one way in
    out.add(from);
    into.add(to);
    edges.push({ from, to });
  }
  return { ok: true, value: { nodes, edges } };
}

/** Nodes in reading order: from the root, along the edges (cycles stop the walk). Unconnected nodes are drafts. */
export function orderFlow(flow: Flow, kind: FlowKind): FlowNode[] {
  const defs = nodeDefs(kind);
  const root = flow.nodes.find((n) => defs[n.type]?.root);
  if (!root) return [];
  const next = new Map(flow.edges.map((e) => [e.from, e.to]));
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const order: FlowNode[] = [];
  const seen = new Set<string>();
  for (let cur: FlowNode | undefined = root; cur && !seen.has(cur.id); cur = byId.get(next.get(cur.id) ?? '')) {
    seen.add(cur.id);
    order.push(cur);
  }
  return order;
}

/* ----------------------------------------------------------- exercise checks */

const unquote = (s: string) => s.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

/** One step of the checks mini-language → a runner Step. */
export function parseStep(src: string): Step | null {
  const s = src.trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^press\s+(.+)$/i))) return { press: unquote(m[1]) };
  if ((m = s.match(/^type\s+(.+?)\s+into\s+(.+)$/i))) return { type: unquote(m[1]), into: unquote(m[2]) };
  if ((m = s.match(/^expect\s+exact\s+(.+)$/i))) return { expectText: unquote(m[1]), exact: true };
  if ((m = s.match(/^expect\s+(.+)$/i))) return { expectText: unquote(m[1]) };
  if ((m = s.match(/^not\s+exact\s+(.+)$/i))) return { expectNoText: unquote(m[1]), exact: true };
  if ((m = s.match(/^not\s+(.+)$/i))) return { expectNoText: unquote(m[1]) };
  if ((m = s.match(/^focused\s+(.+)$/i))) return { expectFocused: unquote(m[1]) };
  if ((m = s.match(/^code\s+\/(.+)\/([gimsuy]*)\s*(.*)$/i))) {
    try { new RegExp(m[1], m[2]); } catch { return null; }
    return { expectCode: m[1], flags: m[2] || undefined, message: m[3].trim() || `Your code should match /${m[1]}/` } as Step;
  }
  if ((m = s.match(/^wait\s+(\d{1,5})$/i))) return { wait: Math.min(5000, Number(m[1])) };
  return null;
}

/** "name :: step; step" lines → runner checks. Reports the first line that doesn't parse. */
export function parseChecks(text: string): Result<Check[]> {
  const checks: Check[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const [i, line] of lines.entries()) {
    const at = line.indexOf('::');
    if (at < 1) return { ok: false, error: `Check line ${i + 1} needs “name :: steps”.` };
    const name = line.slice(0, at).trim();
    const steps: Step[] = [];
    for (const part of line.slice(at + 2).split(';').map((p) => p.trim()).filter(Boolean)) {
      const step = parseStep(part);
      if (!step) return { ok: false, error: `Check “${name}”: don't understand “${part}”.` };
      steps.push(step);
    }
    if (!steps.length) return { ok: false, error: `Check “${name}” has no steps.` };
    checks.push({ name, steps });
  }
  return { ok: true, value: checks };
}

/* ------------------------------------------------------------- compile a lab */

export type Exercise = { title: string; goal?: string; hint?: string; files: Record<string, string>; solution?: Record<string, string>; checks: Check[] };
export type Block =
  | { kind: 'part'; n: string; title: string; time: string }
  | { kind: 'task'; n: string; title: string; time: string; body: string; children: Block[] }
  | { kind: 'text'; body: string }
  | { kind: 'callout'; tone: string; body: string }
  | { kind: 'checkpoint'; body: string }
  | { kind: 'code'; title: string; lang: string; code: string }
  | { kind: 'terminal'; lines: string[] }
  | { kind: 'exercise'; id: string; def: Exercise }
  | { kind: 'repo' }
  | { kind: 'checkin' };

export type CompiledLab = {
  meta: { title: string; description: string; difficulty: string; estimatedTime: string; objectives: string[] };
  blocks: Block[];
  /** MDX-syntax outline (<Part>/<Task>/<Playground>/<RepoSubmit>) for the progress tracker. */
  outline: string;
  exercises: Record<string, Exercise>;
  hasCheckin: boolean;
  /** problems worth showing in the builder (e.g. a check line that doesn't parse) */
  warnings: string[];
};

/** Progress-tracking id of a builder lab: never clashes with file-based labs ("lab-01"). */
export const labKey = (moduleSlug: string, labSlug: string) => `${moduleSlug}--${labSlug}`;
export const splitLabKey = (key: string) => {
  const m = key.match(/^([a-z0-9-]+?)--([a-z0-9-]+)$/);
  return m ? { module: m[1], lab: m[2] } : null;
};
const attrSafe = (s: string) => s.replace(/"/g, '”').replace(/[<>]/g, '');

export function compileLab(flow: Flow, key: string): CompiledLab {
  const order = orderFlow(flow, 'lab');
  const start = order[0]?.data ?? {};
  const blocks: Block[] = [];
  const exercises: Record<string, Exercise> = {};
  const warnings: string[] = [];
  const outline: string[] = [];
  let part = 0;
  let taskInPart = 0;
  let task: Extract<Block, { kind: 'task' }> | null = null;
  let hasCheckin = false;
  const push = (b: Block) => (task ? task.children.push(b) : blocks.push(b));

  for (const node of order.slice(1)) {
    const d = node.data;
    switch (node.type) {
      case 'part':
        part++;
        taskInPart = 0;
        task = null;
        blocks.push({ kind: 'part', n: String(part), title: d.title || `Part ${part}`, time: d.time ?? '' });
        outline.push(`<Part n="${part}" title="${attrSafe(d.title || `Part ${part}`)}" time="${attrSafe(d.time ?? '')}" />`);
        break;
      case 'task': {
        if (part === 0) {
          part = 1;
          blocks.push({ kind: 'part', n: '1', title: 'Tasks', time: '' });
          outline.push('<Part n="1" title="Tasks" />');
        }
        taskInPart++;
        const n = `${part}.${taskInPart}`;
        task = { kind: 'task', n, title: d.title || `Task ${n}`, time: d.time ?? '', body: d.body ?? '', children: [] };
        blocks.push(task);
        outline.push(`<Task n="${n}" title="${attrSafe(task.title)}" time="${attrSafe(task.time)}">`);
        break;
      }
      case 'text': push({ kind: 'text', body: d.body ?? '' }); break;
      case 'callout': push({ kind: 'callout', tone: d.tone || 'TIP', body: d.body ?? '' }); break;
      case 'checkpoint': push({ kind: 'checkpoint', body: d.body ?? '' }); break;
      case 'code': push({ kind: 'code', title: d.title ?? '', lang: d.lang || 'text', code: d.code ?? '' }); break;
      case 'terminal': push({ kind: 'terminal', lines: (d.lines ?? '').split(/\r?\n/).filter((l) => l.length) }); break;
      case 'exercise': {
        const id = `${key}--${node.id}`;
        const checks = parseChecks(d.checks ?? '');
        if (!checks.ok) warnings.push(`Exercise “${d.title}”: ${checks.error}`);
        const def: Exercise = {
          title: d.title || 'Exercise', goal: d.goal || undefined, hint: d.hint || undefined,
          files: { 'App.tsx': d.starter ?? '' }, solution: d.solution ? { 'App.tsx': d.solution } : undefined,
          checks: checks.ok ? checks.value : [],
        };
        exercises[id] = def;
        push({ kind: 'exercise', id, def });
        if (def.checks.length) outline.push(`<Playground ex="${id}" />`);
        else warnings.push(`Exercise “${def.title}” has no checks, so it is shown as a live demo and not graded.`);
        break;
      }
      case 'repo':
        task = null;
        blocks.push({ kind: 'repo' });
        outline.push('<RepoSubmit />');
        break;
      case 'checkin':
        task = null;
        hasCheckin = true;
        blocks.push({ kind: 'checkin' });
        break;
    }
  }
  const objectives = (start.objectives ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return {
    meta: { title: start.title || 'Untitled lab', description: start.description ?? '', difficulty: start.difficulty || 'Beginner', estimatedTime: start.estimatedTime ?? '', objectives },
    blocks, outline: outline.join('\n'), exercises, hasCheckin, warnings,
  };
}

/** Module flow → the module card data and its labs in order, with week labels. */
export function compileModule(flow: Flow): { meta: Record<string, string>; items: ({ kind: 'lab'; slug: string } | { kind: 'week'; title: string })[] } {
  const order = orderFlow(flow, 'module');
  const items = order.slice(1).flatMap((n) =>
    n.type === 'lab' && SLUG_RE.test(n.data.slug ?? '') ? [{ kind: 'lab' as const, slug: n.data.slug }]
      : n.type === 'divider' ? [{ kind: 'week' as const, title: n.data.title || 'Week' }] : []);
  return { meta: order[0]?.data ?? {}, items };
}

/* -------------------------------------------------------------- assessment */

export type AssessmentItem = { label: string; weight: number; detail: string };

/** A module's assessment, set by its module leader: 1–10 components whose weights add up to 100%. */
export function parseAssessment(input: unknown): Result<AssessmentItem[]> {
  const list = Array.isArray(input) ? input : [];
  if (!list.length) return { ok: false, error: 'Add at least one assessment component.' };
  if (list.length > 10) return { ok: false, error: 'Use at most 10 components.' };
  const items: AssessmentItem[] = [];
  for (const raw of list as Record<string, unknown>[]) {
    const label = String(raw?.label ?? '').trim().replace(/\s+/g, ' ');
    const detail = String(raw?.detail ?? '').trim();
    const weight = Number(raw?.weight);
    if (!label || label.length > 60) return { ok: false, error: 'Each component needs a name (up to 60 characters).' };
    if (detail.length > 200) return { ok: false, error: `Keep the description of “${label}” under 200 characters.` };
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) return { ok: false, error: `“${label}” needs a whole-number weight from 1 to 100.` };
    items.push({ label, weight, detail });
  }
  const total = items.reduce((a, i) => a + i.weight, 0);
  if (total !== 100) return { ok: false, error: `The weights add up to ${total}%. They must add up to 100%.` };
  return { ok: true, value: items };
}
