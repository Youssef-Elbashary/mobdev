/**
 * Student side of progress tracking: who the student is (name + ID, remembered in this browser),
 * and sending their checks, Done ticks and repo link to /api/progress/*.
 * Sends go through a small queue in localStorage, so nothing is lost on bad Wi-Fi.
 */
type Identity = { name: string; studentId: string; deviceKey: string };
type Item = { path: string; body: Record<string, unknown> };
type ChipState = 'anon' | 'synced' | 'saving' | 'offline' | 'conflict';

const ME = 'progress:me';
const DEVICE = 'progress:device';
const QUEUE = 'progress:queue';
const SKIP = 'progress:skip';
const MAX_QUEUE = 200;
const MAX_CODE = 20_000;
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*[\p{L}\p{M}.]$/u;
const ID_RE = /^[A-Za-z0-9-]{3,20}$/;

const read = <T>(key: string, fallback: T, store: Storage = localStorage): T => {
  try {
    return JSON.parse(store.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown, store: Storage = localStorage) => {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, JSON.stringify(value));
  } catch {}
};

/** One random key per browser: the server locks a student ID to it. */
function deviceKey(): string {
  let key = read<string | null>(DEVICE, null);
  if (!key) {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    key = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    write(DEVICE, key);
  }
  return key;
}

export const getIdentity = (): Identity | null => read<Identity | null>(ME, null);
const labId = () => document.querySelector<HTMLElement>('[data-lab]')?.dataset.lab ?? '';

/** Keep the attendance/reading identity in sync with the lab's required start card. */
export function setProgressIdentity(name: string, studentId: string): Identity {
  const before = getIdentity();
  const me: Identity = { name, studentId, deviceKey: deviceKey() };
  write(ME, me);
  write(SKIP, null, sessionStorage);
  if (state === 'conflict') state = 'saving';
  setState('saving');
  if (!before || before.studentId !== studentId) syncTicks();
  flushViews(true);
  flush();
  return me;
}

export function clearProgressIdentity() {
  write(ME, null);
  write(QUEUE, []);
  setState('anon');
}

/* ---------------------------------------------------------------- chip */

let state: ChipState = 'anon';
let conflictMessage = '';
function setState(next: ChipState) {
  state = next;
  const me = getIdentity();
  document.querySelectorAll<HTMLElement>('[data-me-chip]').forEach((chip) => {
    chip.dataset.state = next;
    const label = chip.querySelector('[data-me-label]');
    const sub = chip.querySelector('[data-me-sub]');
    if (label) label.textContent = me ? `${me.name.split(' ')[0]} · ${me.studentId}` : 'Track my progress';
    if (sub) sub.textContent = { anon: 'sign in', synced: 'saved', saving: 'saving…', offline: 'offline · will retry', conflict: 'ID in use' }[next];
    chip.title = next === 'conflict' ? conflictMessage : me ? `Signed in as ${me.name} (${me.studentId})` : 'Save your exercise results for your TA';
  });
}

/* --------------------------------------------------------------- queue */

let flushing = false;
async function flush() {
  if (flushing) return;
  if (!read<Item[]>(QUEUE, []).length) {
    if (state !== 'conflict') setState(getIdentity() ? 'synced' : 'anon');
    return;
  }
  flushing = true;
  setState('saving');
  try {
    // re-read the queue every round: new items can be added while a request is in flight
    for (let item = read<Item[]>(QUEUE, [])[0]; item; item = read<Item[]>(QUEUE, [])[0]) {
      let res: Response;
      try {
        res = await fetch(item.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item.body) });
      } catch {
        setState('offline'); // network down: keep everything for later
        return;
      }
      if (res.status === 409) {
        // this ID is locked to another browser: drop its queued items, ask for a TA
        const data = await res.json().catch(() => ({}));
        conflictMessage = data.message ?? 'This student ID is used on another device.';
        write(QUEUE, read<Item[]>(QUEUE, []).filter((q) => q.body.studentId !== item!.body.studentId));
        setState('conflict');
        showSheetError(conflictMessage);
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        setState('offline');
        return;
      }
      write(QUEUE, read<Item[]>(QUEUE, []).slice(1)); // 2xx, or 400 (invalid: retrying would not help)
    }
    if (state !== 'conflict') setState('synced');
  } finally {
    flushing = false;
  }
}

function send(path: string, payload: Record<string, unknown>) {
  const me = getIdentity();
  if (!me) return;
  const queue = read<Item[]>(QUEUE, []);
  queue.push({ path, body: { ...me, ...payload } });
  write(QUEUE, queue.slice(-MAX_QUEUE));
  if (state === 'conflict') state = 'saving';
  flush();
}

export const record = {
  attempt(a: { lab: string; exercise: string; passed: number; total: number; files: Record<string, string> }) {
    let code = JSON.stringify(a.files);
    if (code.length > MAX_CODE) code = JSON.stringify({ 'note.txt': 'The code was too long to save.' });
    send('/api/progress/attempt', { lab: a.lab, exercise: a.exercise, passed: a.passed, total: a.total, code });
  },
  task(t: { lab: string; task: string; done: boolean }) {
    send('/api/progress/task', t);
  },
  async submission(s: { lab: string; url: string }): Promise<{ ok: boolean; message?: string }> {
    const me = await ensureIdentity(true);
    if (!me) return { ok: false, message: 'Sign in with your name and student ID first.' };
    try {
      const res = await fetch('/api/progress/submission', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...me, ...s }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true };
      return { ok: false, message: data.errors?.url ?? data.message ?? 'Could not save it. Try again in a moment.' };
    } catch {
      return { ok: false, message: 'No connection. Try again in a moment.' };
    }
  },
};

/** After signing in, send the Done ticks already on this page. */
function syncTicks() {
  const lab = labId();
  if (!lab) return;
  document.querySelectorAll<HTMLInputElement>('[data-task-check]:checked').forEach((b) => record.task({ lab, task: b.value, done: true }));
}

/* --------------------------------------------------------------- sheet */

let pending: ((id: Identity | null) => void) | null = null;
const sheet = () => document.querySelector<HTMLDialogElement>('[data-me-sheet]');

function showSheetError(message: string) {
  const box = sheet()?.querySelector<HTMLElement>('[data-me-error]');
  if (box) {
    box.textContent = message;
    box.hidden = !message;
  }
}

function openSheet(): Promise<Identity | null> {
  const dlg = sheet();
  if (!dlg) return Promise.resolve(null);
  const me = getIdentity();
  const form = dlg.querySelector('form')!;
  (form.elements.namedItem('name') as HTMLInputElement).value = me?.name ?? '';
  (form.elements.namedItem('studentId') as HTMLInputElement).value = me?.studentId ?? '';
  dlg.querySelector<HTMLElement>('[data-me-out]')!.hidden = !me;
  if (state !== 'conflict') showSheetError('');
  if (!dlg.open) dlg.showModal();
  return new Promise((resolve) => (pending = resolve));
}

function closeSheet(result: Identity | null) {
  sheet()?.close();
  const done = pending;
  pending = null;
  done?.(result);
}

/**
 * The student's identity, asking for it the first time. Resolves null if they skip
 * (the exercise still works, it just isn't saved). `force` asks even after "Skip for now".
 */
export function ensureIdentity(force = false): Promise<Identity | null> {
  const me = getIdentity();
  if (me) return Promise.resolve(me);
  if (!force && read<boolean>(SKIP, false, sessionStorage)) return Promise.resolve(null);
  return openSheet();
}

function wireSheet() {
  const dlg = sheet();
  if (!dlg || dlg.dataset.wired) return;
  dlg.dataset.wired = '1';
  const form = dlg.querySelector('form')!;
  const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement;
  const err = (n: string, msg: string) => {
    const el = dlg.querySelector<HTMLElement>(`[data-me-err="${n}"]`)!;
    el.textContent = msg;
    el.hidden = !msg;
    field(n).setAttribute('aria-invalid', String(!!msg));
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = field('name').value.normalize('NFC').trim().replace(/\s+/g, ' ');
    const studentId = field('studentId').value.trim();
    const badName = name.length < 2 || name.length > 60 || !NAME_RE.test(name);
    const badId = !ID_RE.test(studentId);
    err('name', badName ? 'Please type your full name (letters only).' : '');
    err('studentId', badId ? 'Your student ID should be 3–20 letters or numbers.' : '');
    if (badName || badId) return (badName ? field('name') : field('studentId')).focus();
    const me = setProgressIdentity(name, studentId);
    closeSheet(me);
  });
  dlg.querySelector('[data-me-skip]')!.addEventListener('click', () => {
    if (!getIdentity()) write(SKIP, true, sessionStorage);
    closeSheet(getIdentity());
  });
  dlg.querySelector('[data-me-out]')!.addEventListener('click', () => {
    clearProgressIdentity();
    closeSheet(null);
  });
  dlg.addEventListener('cancel', () => {
    if (!getIdentity()) write(SKIP, true, sessionStorage);
    queueMicrotask(() => closeSheet(getIdentity()));
  });
}

/* ---------------------------------------------------------- repo submit */

function wireRepoBoxes() {
  document.querySelectorAll<HTMLElement>('[data-repo-submit]').forEach((box) => {
    if (box.dataset.wired) return;
    box.dataset.wired = '1';
    const lab = box.dataset.lab!;
    const input = box.querySelector<HTMLInputElement>('[data-repo-url]')!;
    const btn = box.querySelector<HTMLButtonElement>('[data-repo-send]')!;
    const msg = box.querySelector<HTMLElement>('[data-repo-msg]')!;
    const saved = read<string | null>(`progress:repo:${lab}`, null);
    if (saved) {
      input.value = saved;
      box.dataset.state = 'done';
      msg.textContent = '✓ Submitted. Your TA can see it.';
    }
    box.querySelector('form')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      box.dataset.state = 'sending';
      msg.textContent = 'Saving…';
      const r = await record.submission({ lab, url: input.value.trim() });
      btn.disabled = false;
      box.dataset.state = r.ok ? 'done' : 'error';
      msg.textContent = r.ok ? '✓ Submitted. Your TA can see it.' : r.message ?? 'Could not save it.';
      if (r.ok) write(`progress:repo:${lab}`, input.value.trim());
    });
  });
}

/* -------------------------------------------------------------- check-in */

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function wireCheckin() {
  document.querySelectorAll<HTMLElement>('[data-checkin]').forEach((card) => {
    if (card.dataset.wired) return;
    card.dataset.wired = '1';
    const lab = card.dataset.lab!;
    const msg = card.querySelector<HTMLElement>('[data-ci-msg]')!;
    const btn = card.querySelector<HTMLButtonElement>('[data-ci-btn]')!;
    const render = (state: 'open' | 'closed' | 'done' | 'conflict' | 'error', text: string) => {
      card.dataset.state = state;
      msg.textContent = text;
      btn.hidden = state !== 'open';
      btn.disabled = false;
    };
    const doneAt = () => {
      const me = getIdentity();
      const done = read<{ id: string; at: string } | null>(`progress:checkin:${lab}`, null);
      return me && done && done.id === me.studentId ? done.at : null;
    };
    const refresh = async () => {
      const at = doneAt();
      if (at) return render('done', `✓ Checked in at ${clock(at)}. See you next lab!`);
      try {
        const s = await (await fetch(`/api/progress/session?lab=${encodeURIComponent(lab)}`, { cache: 'no-store' })).json();
        if (s.open) render('open', s.closesAt ? `Check-in is open until ${clock(s.closesAt)}.` : 'Check-in is open now.');
        else render('closed', 'Check-in opens during the lab session. Your TA will tell you when.');
      } catch {
        render('error', 'Could not reach the server. Try again in a moment.');
      }
    };
    btn.addEventListener('click', async () => {
      const me = await ensureIdentity(true);
      if (!me) return;
      btn.disabled = true;
      msg.textContent = 'Checking in…';
      try {
        const res = await fetch('/api/progress/checkin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...me, lab }) });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          write(`progress:checkin:${lab}`, { id: me.studentId, at: data.at });
          render('done', `✓ Checked in at ${clock(data.at)}. See you next lab!`);
          flushViews(true);
        } else if (res.status === 409) render('conflict', data.message ?? 'This identity is linked to another device. Ask your TA.');
        else if (res.status === 403 && data.error === 'closed') render('closed', data.message ?? 'Check-in is closed.');
        else render('error', data.message ?? 'Could not check in. Try again in a moment.');
      } catch {
        render('error', 'No connection. Try again in a moment.');
      }
    });
    refresh();
    const timer = window.setInterval(() => {
      if (!card.isConnected) return clearInterval(timer);
      if (document.visibilityState === 'visible' && card.dataset.state !== 'done') refresh();
    }, 30_000);
  });
}

/* ------------------------------------------------------- reading tracker */

type Pending = { seen: string[]; sec: number; sent: string[] };
const SEEN_MS = 4000; // a task must stay in view this long
const IDLE_MS = 60_000; // no interaction for this long = not active
const MAX_BATCH_SEC = 900;
let lastInput = Date.now();
let reading: { stop(): void; flush(force?: boolean): void } | null = null;

const viewsKey = (lab: string) => `progress:views:${lab}`;
function flushViews(force = false) {
  reading?.flush(force);
}

function initReadingTracker() {
  reading?.stop();
  reading = null;
  const lab = labId();
  const tasks = Array.from(document.querySelectorAll<HTMLElement>('.task[data-task], [data-exercise]'));
  if (!lab || !tasks.length || !('IntersectionObserver' in window)) return;
  const get = () => read<Pending>(viewsKey(lab), { seen: [], sec: 0, sent: [] });
  const timers = new Map<Element, number>();
  const markSeen = (n: string) => {
    const p = get();
    if (p.seen.includes(n) || p.sent.includes(n)) return;
    p.seen.push(n);
    write(viewsKey(lab), p);
  };
  // "in view" = 40 % of the task visible, or (for tall tasks) half the screen filled by it
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const target = e.target as HTMLElement;
        const n = target.dataset.task ?? target.dataset.exercise!;
        const inView = e.isIntersecting && (e.intersectionRatio >= 0.4 || e.intersectionRect.height >= window.innerHeight * 0.5);
        if (inView && !timers.has(e.target)) timers.set(e.target, window.setTimeout(() => markSeen(n), SEEN_MS));
        if (!inView && timers.has(e.target)) {
          clearTimeout(timers.get(e.target));
          timers.delete(e.target);
        }
      }),
    { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1] },
  );
  tasks.forEach((t) => io.observe(t));

  let unsaved = 0;
  const tick = window.setInterval(() => {
    if (document.visibilityState !== 'visible' || Date.now() - lastInput > IDLE_MS) return;
    unsaved++;
    if (unsaved >= 5) save();
  }, 1000);
  const save = () => {
    if (!unsaved) return;
    const p = get();
    p.sec += unsaved;
    unsaved = 0;
    write(viewsKey(lab), p);
  };
  const flush = (force = false) => {
    save();
    if (!getIdentity()) return; // kept until the student signs in
    const p = get();
    if (!p.seen.length && (p.sec < 5 || (!force && p.sec < 15))) return;
    const activeSec = Math.min(p.sec, MAX_BATCH_SEC);
    send('/api/progress/views', { lab, seen: p.seen, activeSec });
    write(viewsKey(lab), { seen: [], sec: p.sec - activeSec, sent: [...p.sent, ...p.seen] });
  };
  const every = window.setInterval(() => flush(), 30_000);
  const onHide = () => document.visibilityState === 'hidden' && flush(true);
  document.addEventListener('visibilitychange', onHide);
  reading = {
    flush,
    stop() {
      flush(true);
      io.disconnect();
      timers.forEach((t) => clearTimeout(t));
      clearInterval(tick);
      clearInterval(every);
      document.removeEventListener('visibilitychange', onHide);
    },
  };
}

/* ---------------------------------------------------------------- init */

let listening = false;
export function initProgressUi() {
  wireSheet();
  wireRepoBoxes();
  wireCheckin();
  initReadingTracker();
  document.querySelectorAll<HTMLElement>('[data-me-chip]').forEach((chip) => {
    if (chip.dataset.wired) return;
    chip.dataset.wired = '1';
    chip.addEventListener('click', () => openSheet());
  });
  setState(getIdentity() ? (state === 'conflict' ? 'conflict' : 'synced') : 'anon');
  if (!listening) {
    listening = true;
    window.addEventListener('online', () => flush());
    // any interaction keeps "active time" counting for the next minute
    for (const ev of ['scroll', 'keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'])
      window.addEventListener(ev, () => (lastInput = Date.now()), { passive: true });
    // leaving the lab page (view transition): send what was read
    document.addEventListener('astro:before-swap', () => {
      reading?.stop();
      reading = null;
    });
  }
  flush();
}
