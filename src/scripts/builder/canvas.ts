/**
 * Node builder — an n8n-style canvas for modules and labs (/admin/builder).
 *   Palette: drag a node onto the canvas, or click it to add after the selected node (auto-connected,
 *            inserted between it and its next node).
 *   Canvas:  drag nodes; drag from a node's right port to another node to connect them (a chain: one way
 *            in, one way out; connecting replaces the old link); hover a link and click × to cut it;
 *            drag the background to pan; wheel to zoom; Fit / Auto-layout in the toolbar.
 *   Nodes:   the number on a node is its place in the lab/module (following the links from the root);
 *            unconnected nodes are drafts and are not shown to students.
 *   Keys:    Delete removes the selection · Ctrl+D duplicates · Ctrl+S saves · Esc deselects.
 * The flow is saved as JSON through the admin API and validated again on the server (lib/platform/core).
 */
import { nodeDefs, orderFlow, parseChecks, type Field, type Flow, type FlowKind, type FlowNode, type NodeDef } from '@/lib/platform/core';

export type CanvasConfig = {
  kind: FlowKind;
  flow: Flow;
  saveUrl: string;
  published: boolean;
  previewHref: string;
  /** module canvas: the module's labs, for lab nodes */
  module?: string;
  labs?: { slug: string; title: string; published: boolean }[];
};

const GRID = 20;
const NODE_W = 220;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const uid = () => Math.random().toString(36).slice(2, 10);
const excerpt = (s: string, n = 90) => {
  const t = s.replace(/[#*_`>\[\]]/g, '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export function mountCanvas(root: HTMLElement, cfg: CanvasConfig) {
  const defs = nodeDefs(cfg.kind);
  const flow: Flow = structuredClone(cfg.flow);
  const view = { x: 40, y: 40, k: 1 };
  let selected: string | null = null;
  let dirty = false;
  let published = cfg.published;
  const labs = new Map((cfg.labs ?? []).map((l) => [l.slug, l]));

  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const stage = $('[data-cv-stage]');
  const world = $('[data-cv-world]');
  const svg = root.querySelector<SVGSVGElement>('[data-cv-edges]')!;
  const inspector = $('[data-cv-inspector]');
  const status = $('[data-cv-status]');
  const warningsBox = $('[data-cv-warnings]');
  const publishBtn = $<HTMLButtonElement>('[data-cv-publish]');
  const zoomLabel = $('[data-cv-zoom]');

  /* ------------------------------------------------------------ helpers */

  const nodeById = (id: string) => flow.nodes.find((n) => n.id === id);
  const isRoot = (n: FlowNode) => Boolean(defs[n.type]?.root);
  const outOf = (id: string) => flow.edges.find((e) => e.from === id);
  const intoOf = (id: string) => flow.edges.find((e) => e.to === id);
  const title = (n: FlowNode): string => {
    if (n.type === 'lab') return labs.get(n.data.slug)?.title ?? (n.data.slug ? `Missing lab “${n.data.slug}”` : 'Unlinked lab');
    return n.data.title || n.data.code || defs[n.type].label;
  };
  const summary = (n: FlowNode): string => {
    const d = n.data;
    switch (n.type) {
      case 'start': return [d.difficulty, d.estimatedTime].filter(Boolean).join(' · ');
      case 'module': return [d.code, d.term].filter(Boolean).join(' · ');
      case 'part': case 'task': return [d.time, excerpt(d.body ?? '', 70)].filter(Boolean).join(' · ');
      case 'text': case 'checkpoint': return excerpt(d.body ?? '');
      case 'callout': return `${d.tone} · ${excerpt(d.body ?? '', 70)}`;
      case 'code': return `${d.title || d.lang} · ${(d.code ?? '').split('\n').length} lines`;
      case 'terminal': return excerpt((d.lines ?? '').split('\n')[0] ?? '');
      case 'exercise': {
        const c = parseChecks(d.checks ?? '');
        return c.ok ? (c.value.length ? `${c.value.length} check${c.value.length === 1 ? '' : 's'} · graded` : 'no checks · live demo') : '⚠ checks need fixing';
      }
      case 'lab': { const l = labs.get(d.slug); return l ? (l.published ? 'published' : 'draft') + ` · /${d.slug}` : 'not found'; }
      case 'divider': return 'groups the labs after it';
      default: return defs[n.type].hint;
    }
  };

  const setDirty = (v = true) => {
    dirty = v;
    status.textContent = v ? 'Unsaved changes' : 'All changes saved';
    status.dataset.state = v ? 'dirty' : 'saved';
  };
  const applyView = () => {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    stage.style.backgroundPosition = `${view.x}px ${view.y}px`;
    stage.style.backgroundSize = `${GRID * view.k}px ${GRID * view.k}px`;
    zoomLabel.textContent = `${Math.round(view.k * 100)}%`;
  };
  const toWorld = (cx: number, cy: number) => {
    const r = stage.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  };

  /* ------------------------------------------------------------- render */

  function renderNodes() {
    const order = orderFlow(flow, cfg.kind);
    const pos = new Map(order.map((n, i) => [n.id, i]));
    world.querySelectorAll('[data-node]').forEach((el) => { if (!nodeById((el as HTMLElement).dataset.node!)) el.remove(); });
    for (const n of flow.nodes) {
      const def = defs[n.type];
      let el = world.querySelector<HTMLElement>(`[data-node="${n.id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'cv-node';
        el.dataset.node = n.id;
        world.append(el);
      }
      const i = pos.get(n.id);
      el.style.setProperty('--nc', n.type === 'module' && n.data.color ? n.data.color : def.color);
      el.style.transform = `translate(${n.x}px, ${n.y}px)`;
      el.classList.toggle('is-selected', selected === n.id);
      el.classList.toggle('is-draft', i === undefined);
      el.classList.toggle('is-root', Boolean(def.root));
      el.innerHTML = `
        ${def.root ? '' : '<span class="cv-port in" data-port="in" aria-hidden="true"></span>'}
        <div class="cv-node-head"><span class="cv-glyph">${esc(def.glyph)}</span><span class="cv-type">${esc(def.label)}</span>
          <span class="cv-order mono">${i === undefined ? 'draft' : def.root ? 'start' : `#${i}`}</span></div>
        <div class="cv-node-title">${esc(title(n))}</div>
        <div class="cv-node-sum">${esc(summary(n))}</div>
        ${def.terminal ? '' : `<span class="cv-port out" data-port="out" title="Drag to connect"></span>`}`;
    }
    renderEdges();
  }

  const portPos = (n: FlowNode, side: 'in' | 'out') => {
    const el = world.querySelector<HTMLElement>(`[data-node="${n.id}"]`);
    const h = el?.offsetHeight ?? 80;
    return { x: n.x + (side === 'out' ? NODE_W : 0), y: n.y + Math.min(34, h / 2) };
  };
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = Math.max(60, Math.abs(b.x - a.x) / 2);
    return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  };

  function renderEdges(temp?: { from: FlowNode; to: { x: number; y: number } }) {
    const parts: string[] = [];
    for (const e of flow.edges) {
      const a = nodeById(e.from), b = nodeById(e.to);
      if (!a || !b) continue;
      const p = portPos(a, 'out'), q = portPos(b, 'in');
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      parts.push(`<g class="cv-edge" data-edge="${esc(e.from)}">
        <path class="cv-edge-hit" d="${curve(p, q)}" /><path class="cv-edge-line" d="${curve(p, q)}" />
        <g class="cv-edge-cut" data-cut="${esc(e.from)}" transform="translate(${mx},${my})"><circle r="10" /><path d="M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5" /></g></g>`);
    }
    if (temp) parts.push(`<path class="cv-edge-line temp" d="${curve(portPos(temp.from, 'out'), temp.to)}" />`);
    svg.innerHTML = parts.join('');
  }

  /* ---------------------------------------------------------- inspector */

  function fieldInput(f: Field, value: string): string {
    const id = `f-${f.key}`;
    const help = f.help ? `<small class="cv-help">${esc(f.help)}</small>` : '';
    const label = `<label for="${id}">${esc(f.label)}</label>`;
    switch (f.kind) {
      case 'select': return `${label}<select class="input" id="${id}" data-field="${f.key}">${(f.options ?? []).map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>${help}`;
      case 'number': return `${label}<input class="input" type="number" id="${id}" data-field="${f.key}" value="${esc(value)}" />${help}`;
      case 'color': return `${label}<span class="cv-color"><input type="color" id="${id}" data-field="${f.key}" value="${esc(value || '#7cb1ff')}" /><span class="mono">${esc(value)}</span></span>${help}`;
      case 'textarea': case 'lines': return `${label}<textarea class="input" rows="4" id="${id}" data-field="${f.key}" ${f.max ? `maxlength="${f.max}"` : ''}>${esc(value)}</textarea>${help}`;
      case 'markdown': return `${label}<textarea class="input" rows="7" id="${id}" data-field="${f.key}" ${f.max ? `maxlength="${f.max}"` : ''}>${esc(value)}</textarea><small class="cv-help">Markdown: **bold**, \`code\`, lists, tables, &gt; [!TIP] callouts, \`\`\`code blocks\`\`\`</small>`;
      case 'code': return `${label}<textarea class="input mono cv-code" rows="10" spellcheck="false" id="${id}" data-field="${f.key}" ${f.max ? `maxlength="${f.max}"` : ''}>${esc(value)}</textarea>${help}`;
      case 'checks': return `${label}<textarea class="input mono cv-code" rows="5" spellcheck="false" id="${id}" data-field="${f.key}">${esc(value)}</textarea>${help}<p class="cv-check-msg" data-check-msg></p>`;
      default: return `${label}<input class="input" id="${id}" data-field="${f.key}" value="${esc(value)}" ${f.max ? `maxlength="${f.max}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} />${help}`;
    }
  }

  function renderInspector() {
    const n = selected ? nodeById(selected) : null;
    if (!n) {
      const order = orderFlow(flow, cfg.kind);
      inspector.innerHTML = `<p class="cv-k mono">Inspector</p><h3>Nothing selected</h3>
        <p class="muted">Click a node to edit it. Drag from a node's right-hand port to another node to connect them.</p>
        <dl class="cv-stats"><div><dt>Nodes</dt><dd>${flow.nodes.length}</dd></div><div><dt>In order</dt><dd>${order.length}</dd></div><div><dt>Drafts</dt><dd>${flow.nodes.length - order.length}</dd></div></dl>`;
      return;
    }
    const def: NodeDef = defs[n.type];
    const fields = n.type === 'lab' ? [] : def.fields;
    const labInfo = n.type === 'lab' ? labs.get(n.data.slug) : null;
    inspector.innerHTML = `<p class="cv-k mono" style="--nc:${def.color}"><span class="cv-glyph">${esc(def.glyph)}</span> ${esc(def.label)} node</p>
      <h3>${esc(title(n))}</h3>
      ${n.type === 'lab' ? (labInfo
        ? `<p class="muted">/${esc(cfg.module ?? '')}/${esc(n.data.slug)} · ${labInfo.published ? 'published' : 'draft'}</p>
           <a class="btn btn-primary btn-sm" href="/admin/builder/${encodeURIComponent(cfg.module ?? '')}/${encodeURIComponent(n.data.slug)}" data-open-lab>Open lab canvas →</a>`
        : '<p class="muted">This node points at a lab that no longer exists. Delete it.</p>') : ''}
      <form class="cv-form" data-cv-form>${fields.map((f) => `<div class="cv-field">${fieldInput(f, n.data[f.key] ?? '')}</div>`).join('')}</form>
      ${def.root ? '<p class="cv-help">This is the starting node. It cannot be deleted.</p>' : `
        <div class="cv-node-actions"><button type="button" class="btn btn-ghost btn-sm" data-dup>Duplicate</button>
        <button type="button" class="btn btn-ghost btn-sm cv-danger" data-del>Delete node</button></div>`}`;
    const checkMsg = inspector.querySelector<HTMLElement>('[data-check-msg]');
    const validateChecks = () => {
      if (!checkMsg) return;
      const r = parseChecks(n.data.checks ?? '');
      checkMsg.textContent = r.ok ? (r.value.length ? `✓ ${r.value.length} check${r.value.length === 1 ? '' : 's'} understood` : 'No checks: shown as an ungraded live demo.') : `⚠ ${r.error}`;
      checkMsg.dataset.ok = String(r.ok);
    };
    validateChecks();
    inspector.querySelector('[data-cv-form]')?.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.dataset.field) return;
      n.data[t.dataset.field] = t.value;
      if (t.type === 'color') t.nextElementSibling!.textContent = t.value;
      inspector.querySelector('h3')!.textContent = title(n);
      validateChecks();
      renderNodes();
      setDirty();
    });
    inspector.querySelector('[data-del]')?.addEventListener('click', () => removeNode(n.id));
    inspector.querySelector('[data-dup]')?.addEventListener('click', () => duplicate(n.id));
    inspector.querySelector<HTMLAnchorElement>('[data-open-lab]')?.addEventListener('click', async (e) => {
      if (!dirty) return;
      e.preventDefault();
      if (await save()) location.href = (e.currentTarget as HTMLAnchorElement).href;
    });
  }

  function select(id: string | null) {
    selected = id;
    world.querySelectorAll('.cv-node').forEach((el) => el.classList.toggle('is-selected', (el as HTMLElement).dataset.node === id));
    renderInspector();
  }

  /* -------------------------------------------------------------- edits */

  function addNode(type: string, at?: { x: number; y: number }, data: Record<string, string> = {}) {
    const def = defs[type];
    if (!def || def.root) return null;
    const after = !at && selected ? nodeById(selected) : null;
    const position = at ?? (after ? { x: after.x + NODE_W + 60, y: after.y } : (() => {
      const r = stage.getBoundingClientRect();
      return toWorld(r.left + r.width / 2 - NODE_W / 2, r.top + r.height / 2 - 40);
    })());
    const n: FlowNode = { id: uid(), type, x: snap(position.x), y: snap(position.y), data: { ...def.defaults, ...data } };
    flow.nodes.push(n);
    // clicked from the palette with a node selected: insert after it (selected → new → its old next)
    if (after && !defs[after.type].terminal) {
      const old = outOf(after.id);
      flow.edges = flow.edges.filter((e) => e !== old);
      flow.edges.push({ from: after.id, to: n.id });
      if (old && !def.terminal) flow.edges.push({ from: n.id, to: old.to });
      if (old) shiftRight(old.to, n);
    }
    renderNodes();
    select(n.id);
    setDirty();
    return n;
  }
  /** make room after an insert: push the chain that follows a little to the right if it overlaps */
  function shiftRight(fromId: string, inserted: FlowNode) {
    const seen = new Set<string>();
    for (let cur = nodeById(fromId); cur && !seen.has(cur.id); cur = nodeById(outOf(cur.id)?.to ?? '')) {
      seen.add(cur.id);
      if (Math.abs(cur.y - inserted.y) < 100 && cur.x < inserted.x + NODE_W + 40 && cur.x >= inserted.x - 10) cur.x = inserted.x + NODE_W + 60;
      else break;
    }
  }

  function removeNode(id: string) {
    const n = nodeById(id);
    if (!n || isRoot(n)) return;
    const inE = intoOf(id), outE = outOf(id);
    flow.nodes = flow.nodes.filter((x) => x.id !== id);
    flow.edges = flow.edges.filter((e) => e.from !== id && e.to !== id);
    if (inE && outE) flow.edges.push({ from: inE.from, to: outE.to }); // keep the chain whole
    selected = null;
    renderNodes();
    renderInspector();
    setDirty();
  }

  function duplicate(id: string) {
    const n = nodeById(id);
    if (!n || isRoot(n)) return;
    const copy: FlowNode = { ...structuredClone(n), id: uid(), x: n.x + 40, y: n.y + 120 };
    flow.nodes.push(copy);
    renderNodes();
    select(copy.id);
    setDirty();
  }

  function connect(from: string, to: string) {
    const a = nodeById(from), b = nodeById(to);
    if (!a || !b || from === to || isRoot(b) || defs[a.type].terminal) return;
    flow.edges = flow.edges.filter((e) => e.from !== from && e.to !== to);
    flow.edges.push({ from, to });
    // break a cycle if this link closed one
    const order = orderFlow(flow, cfg.kind).map((n) => n.id);
    if (order.indexOf(to) !== -1 && order.indexOf(to) < order.indexOf(from)) flow.edges = flow.edges.filter((e) => !(e.from === from && e.to === to));
    renderNodes();
    setDirty();
  }

  /** chain in reading order on rows of four, drafts parked underneath */
  function autoLayout() {
    const order = orderFlow(flow, cfg.kind);
    const inChain = new Set(order.map((n) => n.id));
    const perRow = 4;
    order.forEach((n, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      n.x = 40 + (row % 2 ? perRow - 1 - col : col) * (NODE_W + 80);
      n.y = 40 + row * 200;
    });
    const rows = Math.ceil(order.length / perRow);
    flow.nodes.filter((n) => !inChain.has(n.id)).forEach((n, i) => { n.x = 40 + (i % perRow) * (NODE_W + 80); n.y = 80 + (rows + Math.floor(i / perRow)) * 200; });
    renderNodes();
    fit();
    setDirty();
  }

  function fit() {
    if (!flow.nodes.length) return;
    const xs = flow.nodes.map((n) => n.x), ys = flow.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 40, minY = Math.min(...ys) - 40;
    const maxX = Math.max(...xs) + NODE_W + 40, maxY = Math.max(...ys) + 160;
    const r = stage.getBoundingClientRect();
    view.k = Math.max(0.3, Math.min(1.2, Math.min(r.width / (maxX - minX), r.height / (maxY - minY))));
    view.x = (r.width - (maxX - minX) * view.k) / 2 - minX * view.k;
    view.y = (r.height - (maxY - minY) * view.k) / 2 - minY * view.k;
    applyView();
  }

  function zoomAt(factor: number, cx?: number, cy?: number) {
    const r = stage.getBoundingClientRect();
    const px = cx ?? r.left + r.width / 2, py = cy ?? r.top + r.height / 2;
    const before = toWorld(px, py);
    view.k = Math.max(0.25, Math.min(2, view.k * factor));
    view.x = px - r.left - before.x * view.k;
    view.y = py - r.top - before.y * view.k;
    applyView();
  }

  /* ------------------------------------------------------------ pointer */

  type Drag =
    | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
    | { kind: 'move'; id: string; ox: number; oy: number; moved: boolean }
    | { kind: 'link'; from: string };
  let drag: Drag | null = null;
  let lastDown = { id: '', at: 0 };

  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const t = e.target as Element;
    const cut = t.closest('[data-cut]');
    if (cut) {
      flow.edges = flow.edges.filter((x) => x.from !== (cut as HTMLElement).dataset.cut);
      renderNodes();
      setDirty();
      return;
    }
    const nodeEl = t.closest<HTMLElement>('[data-node]');
    if (nodeEl && t.closest('[data-port="out"]')) {
      drag = { kind: 'link', from: nodeEl.dataset.node! };
    } else if (nodeEl) {
      const n = nodeById(nodeEl.dataset.node!)!;
      // double-click a lab node (module canvas) to open its lab canvas; detected here because
      // pointer capture can retarget the native dblclick event
      if (lastDown.id === n.id && Date.now() - lastDown.at < 350 && n.type === 'lab') {
        lastDown = { id: '', at: 0 };
        inspector.querySelector<HTMLAnchorElement>('[data-open-lab]')?.click();
        return;
      }
      lastDown = { id: n.id, at: Date.now() };
      const w = toWorld(e.clientX, e.clientY);
      drag = { kind: 'move', id: n.id, ox: w.x - n.x, oy: w.y - n.y, moved: false };
      if (selected !== n.id) select(n.id);
    } else {
      drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      stage.classList.add('is-panning');
    }
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.kind === 'pan') {
      view.x = drag.vx + e.clientX - drag.sx;
      view.y = drag.vy + e.clientY - drag.sy;
      applyView();
    } else if (drag.kind === 'move') {
      const n = nodeById(drag.id)!;
      const w = toWorld(e.clientX, e.clientY);
      const nx = snap(w.x - drag.ox), ny = snap(w.y - drag.oy);
      if (nx !== n.x || ny !== n.y) {
        n.x = nx; n.y = ny; drag.moved = true;
        world.querySelector<HTMLElement>(`[data-node="${n.id}"]`)!.style.transform = `translate(${n.x}px, ${n.y}px)`;
        renderEdges();
      }
    } else {
      renderEdges({ from: nodeById(drag.from)!, to: toWorld(e.clientX, e.clientY) });
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-node]');
      world.querySelectorAll('.cv-node.is-target').forEach((el) => el.classList.remove('is-target'));
      if (over && over.dataset.node !== drag.from) over.classList.add('is-target');
    }
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag) return;
    if (drag.kind === 'link') {
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-node]');
      world.querySelectorAll('.cv-node.is-target').forEach((el) => el.classList.remove('is-target'));
      if (over) connect(drag.from, over.dataset.node!);
      else renderEdges();
    } else if (drag.kind === 'move' && drag.moved) setDirty();
    else if (drag.kind === 'pan' && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 4) select(null);
    stage.classList.remove('is-panning');
    drag = null;
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY); }, { passive: false });

  /* ------------------------------------------------------------ palette */

  root.querySelectorAll<HTMLElement>('[data-palette]').forEach((item) => {
    item.addEventListener('dragstart', (e) => { e.dataTransfer!.setData('text/x-node', item.dataset.palette!); e.dataTransfer!.effectAllowed = 'copy'; });
    item.addEventListener('click', () => addNode(item.dataset.palette!));
  });
  stage.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('text/x-node') || e.dataTransfer?.types.includes('text/x-lab')) e.preventDefault(); });
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    const at = { x: w.x - NODE_W / 2, y: w.y - 30 };
    const lab = e.dataTransfer?.getData('text/x-lab');
    if (lab) { addNode('lab', at, { slug: lab }); refreshUnplaced(); return; }
    const type = e.dataTransfer?.getData('text/x-node');
    if (type) addNode(type, at);
  });

  /* ------------------------------------------------- module: lab nodes */

  const unplacedBox = root.querySelector<HTMLElement>('[data-cv-unplaced]');
  function refreshUnplaced() {
    if (!unplacedBox) return;
    const placed = new Set(flow.nodes.filter((n) => n.type === 'lab').map((n) => n.data.slug));
    const rest = [...labs.values()].filter((l) => !placed.has(l.slug));
    unplacedBox.innerHTML = rest.length
      ? rest.map((l) => `<button type="button" class="cv-pal" draggable="true" data-unplaced="${esc(l.slug)}" style="--nc:#7cb1ff"><span class="cv-glyph">⚗</span><span><b>${esc(l.title)}</b><small>not on the canvas · drag or click</small></span></button>`).join('')
      : '<p class="cv-help">Every lab is on the canvas.</p>';
    unplacedBox.querySelectorAll<HTMLElement>('[data-unplaced]').forEach((b) => {
      b.addEventListener('dragstart', (e) => e.dataTransfer!.setData('text/x-lab', b.dataset.unplaced!));
      b.addEventListener('click', () => { addNode('lab', undefined, { slug: b.dataset.unplaced! }); refreshUnplaced(); });
    });
  }
  refreshUnplaced();
  root.querySelector<HTMLFormElement>('[data-cv-newlab]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.querySelector('input')!;
    const msg = form.querySelector<HTMLElement>('[data-newlab-msg]')!;
    if (!input.value.trim()) return;
    const res = await fetch('/api/admin/platform/labs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ module: cfg.module, title: input.value }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { msg.textContent = data.error ?? 'Could not create the lab.'; return; }
    msg.textContent = '';
    input.value = '';
    labs.set(data.lab.slug, { slug: data.lab.slug, title: data.lab.title, published: false });
    addNode('lab', undefined, { slug: data.lab.slug });
    refreshUnplaced();
    await save();
  });

  /* ------------------------------------------------------- save, publish */

  async function save(): Promise<boolean> {
    status.textContent = 'Saving…';
    status.dataset.state = 'saving';
    try {
      const res = await fetch(cfg.saveUrl, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ flow }) });
      if (res.status === 401) { location.reload(); return false; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not save.');
      setDirty(false);
      showWarnings(data.warnings ?? [], data.stats);
      return true;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not save.';
      status.dataset.state = 'error';
      return false;
    }
  }
  function showWarnings(list: string[], stats?: { tasks: number; exercises: number }) {
    warningsBox.hidden = !list.length && !stats;
    warningsBox.innerHTML = `${stats ? `<p class="mono">${stats.tasks} task${stats.tasks === 1 ? '' : 's'} · ${stats.exercises} exercise${stats.exercises === 1 ? '' : 's'}</p>` : ''}${list.map((w) => `<p>⚠ ${esc(w)}</p>`).join('')}`;
  }
  const renderPublish = () => {
    publishBtn.textContent = published ? 'Published ✓' : 'Publish';
    publishBtn.classList.toggle('btn-primary', !published);
    publishBtn.title = published ? 'Click to unpublish (hide from students)' : 'Make it visible to students';
  };
  renderPublish();
  publishBtn.addEventListener('click', async () => {
    if (dirty && !(await save())) return;
    publishBtn.disabled = true;
    const res = await fetch(cfg.saveUrl, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ published: !published }) });
    publishBtn.disabled = false;
    if (res.ok) { published = !published; renderPublish(); status.textContent = published ? 'Published: students can see it' : 'Unpublished: hidden from students'; }
  });

  $('[data-cv-save]').addEventListener('click', () => void save());
  $('[data-cv-fit]').addEventListener('click', fit);
  $('[data-cv-layout]').addEventListener('click', autoLayout);
  $('[data-cv-zoom-in]').addEventListener('click', () => zoomAt(1.2));
  $('[data-cv-zoom-out]').addEventListener('click', () => zoomAt(1 / 1.2));
  root.querySelector<HTMLAnchorElement>('[data-cv-preview]')?.addEventListener('click', async (e) => {
    if (!dirty) return;
    e.preventDefault();
    const href = (e.currentTarget as HTMLAnchorElement).href;
    if (await save()) window.open(href, '_blank', 'noopener');
  });

  document.addEventListener('keydown', (e) => {
    if (!root.isConnected) return;
    const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); return; }
    if (typing) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); removeNode(selected); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selected) { e.preventDefault(); duplicate(selected); }
    else if (e.key === 'Escape') select(null);
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });

  renderNodes();
  renderInspector();
  applyView();
  requestAnimationFrame(() => { renderEdges(); fit(); });
  setDirty(false);
}
