import type { Field } from '@/lib/cms/fields';
import { renderForm, type FormErrors } from './form';
import { reviewDialog, type DiffLine } from './diff-view';

type Status = {
  editor: string;
  mode: 'github' | 'local';
  changed: { path: string; status: string }[];
  ahead: number;
  previewUrl: string | null;
  prUrl: string | null;
};
type Entry = { id: string; value: Record<string, unknown> };

const LISTS = ['commands', 'troubleshooting', 'resources', 'extra', 'roadmap', 'checklist'] as const;
const labels: Record<string, string> = {
  commands: 'Commands', troubleshooting: 'Troubleshooting', resources: 'Resources', extra: 'Extra learning', roadmap: 'Roadmap', checklist: 'Setup checklist',
};

let dirty = false;
let active = 'course';
let root: HTMLElement | null = null;
let main: HTMLElement | null = null;
let unloadBound = false;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message ?? 'Something went wrong.'), { status: response.status, data });
  return data as T;
}

function setDirty(value: boolean) {
  dirty = value;
  root?.classList.toggle('is-dirty', value);
}

function toast(message: string, kind: 'ok' | 'error' = 'ok') {
  const node = el('div', `cms-toast ${kind}`, message);
  node.setAttribute('role', 'status');
  document.body.append(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => { node.classList.remove('show'); setTimeout(() => node.remove(), 250); }, 3500);
}

function errorBanner(error: any) {
  const info = error.data?.info;
  const banner = el('div', 'cms-banner error');
  if (error.status === 409) {
    const when = info?.at ? new Date(info.at).toLocaleString() : 'recently';
    banner.textContent = `Saved by ${info?.by ?? 'someone else'} at ${when}. Reload this editor before saving.`;
    const reload = el('button', 'btn btn-ghost btn-sm', 'Reload');
    reload.type = 'button'; reload.onclick = () => navigate(active, true);
    banner.append(reload);
  } else banner.textContent = error.message;
  main?.prepend(banner);
}

async function refreshStatus() {
  const status = await request<Status>('/api/cms/status');
  document.querySelectorAll<HTMLElement>('[data-cms-editor]').forEach((n) => (n.textContent = status.editor));
  const mode = document.querySelector<HTMLElement>('[data-cms-mode]');
  if (mode) mode.textContent = status.mode === 'github' ? 'GitHub drafts' : 'Local files';
  const summary = document.querySelector<HTMLElement>('[data-cms-summary]');
  if (summary) summary.textContent = status.mode === 'local' ? 'Saved straight to files' : `${status.changed.length} unpublished ${status.changed.length === 1 ? 'change' : 'changes'}`;
  const files = document.querySelector<HTMLElement>('[data-cms-files]');
  if (files) {
    files.replaceChildren(...status.changed.map((change) => el('li', '', `${change.status}  ${change.path}`)));
    files.hidden = status.changed.length === 0;
  }
  const preview = document.querySelector<HTMLAnchorElement>('[data-cms-preview]');
  if (preview) { preview.href = status.previewUrl ?? '#'; preview.hidden = !status.previewUrl; }
  document.querySelectorAll<HTMLButtonElement>('[data-cms-publish], [data-cms-discard]').forEach((button) => {
    button.hidden = status.mode === 'local';
    button.disabled = status.changed.length === 0;
  });
}

function pageHead(kicker: string, title: string, description: string) {
  const head = el('header', 'cms-view-head');
  const copy = el('div');
  copy.append(el('p', 'cms-k mono', kicker), el('h1', '', title), el('p', 'muted', description));
  head.append(copy);
  return head;
}

async function showCourse() {
  if (!main) return;
  main.replaceChildren(pageHead('Course & team', 'Course information', 'Edit the shared course details, teaching team and assessment split.'));
  main.append(el('div', 'cms-loading', 'Loading course information\u2026'));
  try {
    const data = await request<{ value: Record<string, any>; sha: string; fields: Field[] }>('/api/cms/site');
    let value = structuredClone(data.value);
    let errors: FormErrors = {};
    const layout = el('div', 'cms-course-layout');
    const editor = el('section', 'cms-card cms-editor');
    const side = el('aside', 'cms-card cms-preview-card');
    const drawPreview = () => {
      side.replaceChildren(el('p', 'cms-k mono', 'Live preview'), el('h2', '', 'Assessment split'));
      const total = (value.assessment ?? []).reduce((sum: number, row: any) => sum + Number(row.weight || 0), 0);
      const bar = el('div', 'cms-split-preview');
      for (const row of value.assessment ?? []) {
        const part = el('span'); part.style.width = `${Math.max(0, Number(row.weight || 0))}%`; part.title = `${row.label}: ${row.weight}%`; bar.append(part);
      }
      side.append(bar);
      for (const row of value.assessment ?? []) {
        const line = el('div', 'cms-assessment-row');
        line.append(el('span', '', String(row.label ?? 'Untitled')), el('b', 'mono', `${row.weight ?? 0}%`)); side.append(line);
      }
      const sum = el('p', `cms-total ${total === 100 ? 'ok' : 'bad'}`, `Total: ${total}%`); side.append(sum);
    };
    const drawForm = () => {
      editor.replaceChildren(renderForm(data.fields, value, (next) => { value = next; setDirty(true); drawPreview(); }, { errors }));
      const actions = el('div', 'cms-form-actions');
      const reset = el('button', 'btn btn-ghost', 'Reset'); reset.type = 'button'; reset.onclick = () => { value = structuredClone(data.value); errors = {}; setDirty(false); drawForm(); drawPreview(); };
      const review = el('button', 'btn btn-primary', 'Review & save'); review.type = 'button'; review.onclick = () => reviewSave('/api/cms/site', { value, baseSha: data.sha }, async () => { setDirty(false); toast('Course information saved.'); await showCourse(); }, (next) => { errors = next; drawForm(); });
      actions.append(reset, review); editor.append(actions);
    };
    drawForm(); drawPreview(); layout.append(editor, side); main.replaceChildren(pageHead('Course & team', 'Course information', 'Edit the shared course details, teaching team and assessment split.'), layout);
  } catch (error) { main.append(el('p', 'cms-banner error', (error as Error).message)); }
}

function blankValue(fields: Field[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    out[field.key] = field.type === 'number' ? 0 : field.type === 'rows' || field.type === 'list' ? [] : field.type === 'group' ? blankValue(field.fields) : field.type === 'enum' ? field.options[0] : '';
  }
  return out;
}

function entryTitle(entry: Entry) {
  return String(entry.value.title ?? entry.value.problem ?? entry.value.label ?? entry.value.command ?? entry.id);
}

async function showList(name: string) {
  if (!main) return;
  main.replaceChildren(pageHead('Lists', labels[name], 'Search, edit, add, duplicate, remove or reorder entries.'));
  main.append(el('div', 'cms-loading', `Loading ${labels[name].toLowerCase()}\u2026`));
  try {
    const data = await request<{ entries: Entry[]; sha: string; fields: Field[]; label: string; singular: string }>(`/api/cms/list/${name}`);
    let selected: Entry | null = data.entries[0] ?? null;
    let edited = selected ? { ...structuredClone(selected.value), id: selected.id } : blankValue(data.fields);
    let isNew = false;
    let errors: FormErrors = {};
    const layout = el('div', 'cms-list-layout');
    const browser = el('section', 'cms-card cms-list-browser');
    const panel = el('section', 'cms-card cms-editor cms-entry-editor');
    const search = document.createElement('input'); search.className = 'input'; search.type = 'search'; search.placeholder = `Search ${data.label.toLowerCase()}\u2026`; search.setAttribute('aria-label', `Search ${data.label}`);
    const list = el('div', 'cms-entry-list');

    const select = (entry: Entry, fresh = false) => {
      if (dirty && !confirm('Discard your unsaved changes?')) return;
      selected = entry; edited = { ...structuredClone(entry.value), id: entry.id }; isNew = fresh; errors = {}; setDirty(false); drawList(); drawEditor();
    };
    const visible = () => {
      const q = search.value.toLowerCase().trim();
      return data.entries.filter((entry) => `${entry.id} ${entryTitle(entry)}`.toLowerCase().includes(q));
    };
    const drawList = () => {
      list.replaceChildren();
      visible().forEach((entry, index) => {
        const row = el('button', `cms-entry${selected?.id === entry.id && !isNew ? ' active' : ''}`); row.type = 'button';
        const copy = el('span'); copy.append(el('b', '', entryTitle(entry)), el('small', 'mono', entry.id));
        row.append(copy); row.onclick = () => select(entry); list.append(row);
      });
      if (!visible().length) list.append(el('p', 'cms-empty', 'No matching entries.'));
    };
    const newButton = el('button', 'btn btn-primary btn-sm', '+ New'); newButton.type = 'button'; newButton.onclick = () => select({ id: '', value: blankValue(data.fields) }, true);
    const top = el('div', 'cms-list-top'); top.append(search, newButton); browser.append(top, list); search.oninput = drawList;

    const drawEditor = () => {
      panel.replaceChildren();
      if (!selected) { panel.append(el('p', 'cms-empty', 'Create the first entry to get started.')); return; }
      const head = el('div', 'cms-entry-head');
      const title = el('div'); title.append(el('p', 'cms-k mono', isNew ? `New ${data.singular}` : selected.id), el('h2', '', isNew ? `Add ${data.singular}` : entryTitle(selected)));
      const tools = el('div', 'cms-entry-tools');
      if (!isNew) {
        const duplicate = el('button', 'btn btn-ghost btn-sm', 'Duplicate'); duplicate.type = 'button'; duplicate.onclick = () => {
          const copy = structuredClone(selected!.value); copy.id = `${selected!.id}-copy`; select({ id: String(copy.id), value: copy }, true);
        };
        const up = el('button', 'btn btn-ghost btn-sm', '\u2191'); up.type = 'button'; up.title = 'Move up';
        const down = el('button', 'btn btn-ghost btn-sm', '\u2193'); down.type = 'button'; down.title = 'Move down';
        const position = data.entries.findIndex((entry) => entry.id === selected!.id);
        up.disabled = position <= 0; down.disabled = position < 0 || position >= data.entries.length - 1;
        up.onclick = () => reviewListOp(name, { op: 'move', id: selected!.id, toIndex: position - 1, baseSha: data.sha }, 'Entry moved.');
        down.onclick = () => reviewListOp(name, { op: 'move', id: selected!.id, toIndex: position + 1, baseSha: data.sha }, 'Entry moved.');
        const remove = el('button', 'btn btn-ghost btn-sm cms-danger', 'Delete'); remove.type = 'button'; remove.onclick = () => { if (confirm(`Delete "${selected!.id}"? You will review the diff before it is saved.`)) reviewListOp(name, { op: 'remove', id: selected!.id, baseSha: data.sha }, 'Entry deleted.'); };
        tools.append(duplicate, up, down, remove);
      }
      head.append(title, tools); panel.append(head);
      panel.append(renderForm(data.fields, edited, (next) => { edited = next; setDirty(true); }, { errors, newEntry: isNew }));
      const actions = el('div', 'cms-form-actions');
      const reset = el('button', 'btn btn-ghost', 'Reset'); reset.type = 'button'; reset.onclick = () => { edited = { ...structuredClone(selected!.value), id: selected!.id }; errors = {}; setDirty(false); drawEditor(); };
      const review = el('button', 'btn btn-primary', 'Review & save'); review.type = 'button'; review.onclick = () => reviewSave(`/api/cms/list/${name}`, { op: isNew ? 'add' : 'set', id: String(edited.id ?? selected!.id), value: edited, baseSha: data.sha }, async () => { setDirty(false); toast(isNew ? 'Entry added.' : 'Entry saved.'); await showList(name); }, (next) => { errors = next; drawEditor(); });
      actions.append(reset, review); panel.append(actions);
    };
    drawList(); drawEditor(); layout.append(browser, panel); main.replaceChildren(pageHead('Lists', data.label, 'Search, edit, add, duplicate, remove or reorder entries.'), layout);
  } catch (error) { main.append(el('p', 'cms-banner error', (error as Error).message)); }
}

async function reviewListOp(name: string, body: Record<string, unknown>, success: string) {
  await reviewSave(`/api/cms/list/${name}`, body, async () => { setDirty(false); toast(success); await showList(name); });
}

async function reviewSave(url: string, body: Record<string, unknown>, onSaved: () => Promise<void>, onInvalid?: (errors: FormErrors) => void) {
  main?.querySelector('.cms-banner')?.remove();
  try {
    const preview = await request<{ diff?: DiffLine[]; path?: string; message?: string; unchanged?: boolean }>(url, { method: 'POST', body: JSON.stringify({ ...body, dryRun: true }) });
    if (preview.unchanged) { toast('Nothing changed.'); setDirty(false); return; }
    reviewDialog({
      diff: preview.diff ?? [], path: preview.path ?? '', message: preview.message ?? 'CMS save',
      onSave: async () => {
        try { await request(url, { method: 'POST', body: JSON.stringify({ ...body, dryRun: false }) }); await onSaved(); await refreshStatus(); }
        catch (error) { errorBanner(error); throw error; }
      },
    });
  } catch (error: any) {
    if (error.data?.errors) {
      onInvalid?.(error.data.errors);
      errorBanner(Object.assign(new Error('Please fix the highlighted validation errors.'), { data: error.data }));
    } else errorBanner(error);
  }
}

async function showHistory() {
  if (!main) return;
  main.replaceChildren(pageHead('History', 'Recent CMS saves', 'Draft and published changes made through this editor.'));
  try {
    const data = await request<{ items: { sha: string; message: string; date: string; url: string | null }[] }>('/api/cms/history');
    const list = el('div', 'cms-card cms-history');
    if (!data.items.length) list.append(el('p', 'cms-empty', 'No CMS saves yet.'));
    for (const item of data.items) {
      const row = item.url ? document.createElement('a') : document.createElement('div');
      row.className = 'cms-history-row';
      if (item.url && row instanceof HTMLAnchorElement) { row.href = item.url; row.target = '_blank'; row.rel = 'noreferrer'; }
      const copy = el('span'); copy.append(el('b', '', item.message), el('small', 'mono', new Date(item.date).toLocaleString()));
      row.append(copy, el('code', '', item.sha.slice(0, 8))); list.append(row);
    }
    main.append(list);
  } catch (error) { errorBanner(error); }
}

async function navigate(view: string, force = false) {
  if (!force && dirty && !confirm('Discard your unsaved changes?')) return;
  setDirty(false); active = view;
  document.querySelectorAll<HTMLButtonElement>('[data-cms-view]').forEach((button) => button.setAttribute('aria-current', String(button.dataset.cmsView === view)));
  if (view === 'course') await showCourse(); else if (view === 'history') await showHistory(); else await showList(view);
}

function init() {
  root = document.querySelector<HTMLElement>('[data-cms-app]');
  main = document.querySelector<HTMLElement>('[data-cms-main]');
  if (!root || !main || root.dataset.ready === 'true') return;
  root.dataset.ready = 'true';
  document.querySelectorAll<HTMLButtonElement>('[data-cms-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.cmsView!)));
  document.querySelector<HTMLButtonElement>('[data-cms-switch]')?.addEventListener('click', async () => { if (!dirty || confirm('Discard your unsaved changes and switch editor?')) { await request('/api/cms/editor', { method: 'DELETE' }); location.reload(); } });
  document.querySelector<HTMLButtonElement>('[data-cms-publish]')?.addEventListener('click', async () => {
    if (!confirm('Publish all draft changes to the live site?')) return;
    try { await request('/api/cms/publish', { method: 'POST' }); toast('Drafts published. The live build is starting.'); await refreshStatus(); }
    catch (error) { errorBanner(error); }
  });
  document.querySelector<HTMLButtonElement>('[data-cms-discard]')?.addEventListener('click', async () => {
    if (!confirm('Discard every unpublished CMS change? This cannot be undone.')) return;
    try { await request('/api/cms/discard', { method: 'POST' }); toast('Unpublished changes discarded.'); await refreshStatus(); await navigate(active, true); }
    catch (error) { errorBanner(error); }
  });
  if (!unloadBound) {
    addEventListener('beforeunload', (event) => { if (dirty) event.preventDefault(); });
    unloadBound = true;
  }
  refreshStatus().catch(errorBanner);
  navigate('course', true);
}

document.addEventListener('astro:page-load', init);
init();
