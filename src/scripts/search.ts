/**
 * Command-palette search. Index is generated at build time by
 * src/pages/search-index.json.ts from every content collection, and fetched
 * lazily the first time the palette opens.
 */
type Item = { k: string; t: string; d: string; u: string; s?: string; m?: string };

const KIND_ORDER = ['Page', 'Lab', 'Coursework', 'Project', 'Command', 'Tool', 'Setup', 'Troubleshooting', 'Resource', 'Extra'];
const ICONS: Record<string, string> = {
  Page: '<path d="M4 5h16M4 12h16M4 19h10"/>',
  Lab: '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  Coursework: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  Project: '<path d="M12 15 9 12a15 15 0 0 1 9-9c1.3 0 3 1.7 3 3a15 15 0 0 1-9 9Z"/><path d="M9 12H4s.6-3 2-4c1.6-1 5 0 5 0M12 15v5s3-.6 4-2c1-1.6 0-5 0-5"/>',
  Command: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  Tool: '<path d="M12.7 6.3a4 4 0 0 0 5 5L19 13l-8 8-3-3 8-8-1.3-1.3a4 4 0 0 1-5-5L11 2l1.7 4.3Z"/>',
  Setup: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  Troubleshooting: '<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 7V4M3 12h4M17 12h4M4 18l3-2M20 18l-3-2"/>',
  Resource: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/>',
  Extra: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>',
};
const LABEL: Record<string, string> = { Page: 'Pages', Lab: 'Labs', Coursework: 'Coursework', Project: 'Project', Command: 'Commands', Tool: 'Tools', Setup: 'Setup guides', Troubleshooting: 'Troubleshooting', Resource: 'Resources', Extra: 'Extra learning' };

let index: Item[] | null = null;
let loading: Promise<Item[]> | null = null;
let active = 0;
let current: Item[] = [];
let filter = 'All';
let returnFocus: HTMLElement | null = null;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

function load() {
  if (index) return Promise.resolve(index);
  loading ??= fetch('/search-index.json').then((r) => r.json()).then((d: Item[]) => (index = d));
  return loading;
}

function highlight(text: string, terms: string[]) {
  let out = esc(text);
  terms.filter((t) => t.length > 1).forEach((t) => {
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    out = out.replace(re, '<mark>$1</mark>');
  });
  return out;
}

function score(item: Item, terms: string[]) {
  const t = norm(item.t), d = norm(item.d), s = norm(item.s || ''), m = norm(item.m || '');
  let total = 0;
  for (const term of terms) {
    let best = 0;
    if (t === term) best = 100;
    else if (t.startsWith(term)) best = 60;
    else if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) best = 45;
    else if (t.includes(term)) best = 30;
    else if (m.includes(term)) best = 22;
    else if (d.includes(term)) best = 14;
    else if (s.includes(term)) best = 8;
    if (!best) return 0;
    total += best;
  }
  return total + (item.k === 'Page' ? 4 : 0);
}

function run(q: string) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const pool = (index || []).filter((i) => filter === 'All' || i.k === filter);
  if (!terms.length) {
    current = filter === 'All' ? pool.filter((i) => i.k === 'Page') : pool.slice(0, 40);
    return { results: current, terms };
  }
  current = pool
    .map((i) => ({ i, s: score(i, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || KIND_ORDER.indexOf(a.i.k) - KIND_ORDER.indexOf(b.i.k))
    .slice(0, 40)
    .map((x) => x.i);
  return { results: current, terms };
}

function render(q: string) {
  const box = document.querySelector<HTMLElement>('[data-search-results]');
  if (!box) return;
  if (!index) {
    box.innerHTML = '<div class="sp-loading" aria-label="Loading"><div></div><div></div><div></div></div>';
    return;
  }
  const { results, terms } = run(q);
  active = 0;
  if (!results.length) {
    box.innerHTML = `<div class="sp-empty"><div class="glyph">$ grep "<b>${esc(q)}</b>" course/ <br/>→ 0 matches</div><strong>No results found.</strong><span class="faint">Try a broader term like “git”, “emulator” or “lab”.</span></div>`;
    return;
  }
  // group preserving rank order of first appearance when searching; kind order when browsing
  const groups = new Map<string, Item[]>();
  const order = terms.length ? results : [...results].sort((a, b) => KIND_ORDER.indexOf(a.k) - KIND_ORDER.indexOf(b.k));
  const cap = terms.length && filter === 'All' ? 5 : Infinity; // keep every kind visible
  order.forEach((r) => {
    if (!groups.has(r.k)) groups.set(r.k, []);
    const g = groups.get(r.k)!;
    if (g.length < cap) g.push(r);
  });
  current = [...groups.values()].flat();
  let n = 0;
  box.innerHTML = [...groups.entries()]
    .map(([k, items]) =>
      `<div class="sp-group" role="presentation">${terms.length ? LABEL[k] : 'Jump to'}</div>` +
      items
        .map((it) => {
          const id = `sp-opt-${n}`;
          const html = `<a href="${esc(it.u)}" class="sp-item" role="option" id="${id}" data-i="${n}" aria-selected="${n === 0}">
            <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[it.k] || ICONS.Page}</svg></span>
            <span style="min-width:0"><div class="t">${k === 'Command' ? `<code>${highlight(it.t, terms)}</code>` : highlight(it.t, terms)}</div><div class="d">${highlight(it.d, terms)}</div></span>
            <span class="meta">${esc(it.m || '')}</span></a>`;
          n++;
          return html;
        })
        .join(''),
    )
    .join('');
  document.querySelector('[data-search-input]')?.setAttribute('aria-activedescendant', 'sp-opt-0');
}

function renderFilters() {
  const bar = document.querySelector<HTMLElement>('[data-search-filters]');
  if (!bar || !index) return;
  const kinds = KIND_ORDER.filter((k) => k !== 'Page' && index!.some((i) => i.k === k));
  bar.innerHTML = ['All', ...kinds]
    .map((k) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${k === filter}">${k === 'All' ? 'All' : LABEL[k]}</button>`)
    .join('');
}

function setActive(i: number) {
  const items = Array.from(document.querySelectorAll<HTMLElement>('.sp-item'));
  if (!items.length) return;
  active = (i + items.length) % items.length;
  items.forEach((el, k) => el.setAttribute('aria-selected', String(k === active)));
  items[active].scrollIntoView({ block: 'nearest' });
  document.querySelector('[data-search-input]')?.setAttribute('aria-activedescendant', items[active].id);
}

export function openSearch(prefill = '') {
  const root = document.querySelector<HTMLElement>('[data-search]');
  if (!root || !root.hidden) return;
  returnFocus = document.activeElement as HTMLElement;
  root.hidden = false;
  document.body.style.overflow = 'hidden';
  const input = root.querySelector<HTMLInputElement>('[data-search-input]')!;
  input.value = prefill;
  input.focus();
  render(prefill);
  load().then(() => { renderFilters(); render(input.value); });
}
function closeSearch() {
  const root = document.querySelector<HTMLElement>('[data-search]');
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.style.overflow = '';
  returnFocus?.focus?.();
}

export function initSearch() {
  document.addEventListener('keydown', (e) => {
    const root = document.querySelector<HTMLElement>('[data-search]');
    const open = root && !root.hidden;
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open ? closeSearch() : openSearch(); return; }
    if (e.key === '/' && !typing && !open) {
      e.preventDefault();
      // pages with their own filter (e.g. Command Handbook) focus it instead
      const local = document.querySelector<HTMLInputElement>('[data-local-search]');
      local ? (local.focus(), local.select()) : openSearch();
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') {
      const el = document.querySelectorAll<HTMLAnchorElement>('.sp-item')[active];
      if (el) { e.preventDefault(); closeSearch(); el.click(); }
    } else if (e.key === 'Tab') {
      // keep focus inside dialog
      const f = Array.from(root!.querySelectorAll<HTMLElement>('input, button, a[href]'));
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches('[data-search-input]')) render((t as HTMLInputElement).value);
  });
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const opener = t.closest<HTMLElement>('[data-search-open]');
    if (opener) { openSearch(opener.dataset.searchQuery || ''); return; }
    if (t.closest('[data-search-close]')) { closeSearch(); return; }
    const f = t.closest<HTMLElement>('[data-filter]');
    if (f) {
      filter = f.dataset.filter!;
      renderFilters();
      const input = document.querySelector<HTMLInputElement>('[data-search-input]')!;
      render(input.value);
      input.focus();
      return;
    }
    if (t.closest('.sp-item')) closeSearch();
  });
  document.addEventListener('mousemove', (e) => {
    const it = (e.target as HTMLElement).closest?.<HTMLElement>('.sp-item');
    if (it && Number(it.dataset.i) !== active) setActive(Number(it.dataset.i));
  });
  // warm the index when idle so first open is instant
  const idle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1500));
  idle(() => load().catch(() => {}));
}
