/**
 * Page side of <Playground> and <AppWalkthrough>. Lazy: the editor loads when a playground
 * nears the viewport; the runner iframe loads on Run (exercises) or when visible (demos).
 */
import type { Check, CheckResult, Files, FromRunner, ToRunner } from '@/runner/protocol';
import type { Editor } from './editor';
import { ensureIdentity, record } from '../progress';

type Def = { id: string; files: Files; checks: Check[] };
const RUNNER = '/runner/index.html';
/** Apps are laid out at a real phone width, then scaled down to fit the phone frame. */
const PHONE_WIDTH = 300;

function fitToScreen(screen: HTMLElement, frame: HTMLIFrameElement) {
  const fit = () => {
    const s = screen.clientWidth / PHONE_WIDTH;
    if (!s) return;
    Object.assign(frame.style, {
      width: `${PHONE_WIDTH}px`,
      height: `${screen.clientHeight / s}px`,
      transform: `scale(${s})`,
      transformOrigin: '0 0',
    });
  };
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(screen);
}

/* one listener for every runner iframe on the page, routed by the iframe's window */
const handlers = new Map<Window, (m: FromRunner) => void>();
window.addEventListener('message', (e) => {
  const h = e.source && handlers.get(e.source as Window);
  if (h) h(e.data as FromRunner);
});

const loadSaved = (id: string): Files | null => {
  try {
    return JSON.parse(localStorage.getItem(`playground:${id}`) || 'null');
  } catch {
    return null;
  }
};
const save = (id: string, files: Files | null) => {
  try {
    if (files) localStorage.setItem(`playground:${id}`, JSON.stringify(files));
    else localStorage.removeItem(`playground:${id}`);
  } catch {}
};
const nearView = (el: Element, cb: () => void, margin = '300px') => {
  if (!('IntersectionObserver' in window)) return cb();
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) {
      io.disconnect();
      cb();
    }
  }, { rootMargin: margin });
  io.observe(el);
};

/** One sandboxed runner per playground, created on first use. */
function createFrame(screen: HTMLElement, onMessage: (m: FromRunner) => void) {
  let frame: HTMLIFrameElement | null = null;
  let ready: Promise<void> | null = null;
  const ensure = () => {
    if (ready) return ready;
    frame = Object.assign(document.createElement('iframe'), { src: RUNNER, title: 'App preview' });
    frame.setAttribute('sandbox', 'allow-scripts');
    ready = new Promise<void>((resolve) => {
      screen.replaceChildren(frame!);
      fitToScreen(screen, frame!);
      handlers.set(frame!.contentWindow!, (m) => {
        if (m.type === 'ready') resolve();
        onMessage(m);
      });
    });
    return ready;
  };
  return {
    ensure,
    async send(m: ToRunner) {
      await ensure();
      frame!.contentWindow!.postMessage(m, '*');
    },
  };
}

function setupPlayground(root: HTMLElement) {
  const def = JSON.parse(root.querySelector('script[data-pg-def]')!.textContent!) as Def;
  const exercise = root.dataset.mode === 'exercise';
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
  let files: Files = { ...def.files, ...(loadSaved(def.id) ?? {}) };
  let current = Object.keys(def.files)[0];
  let editor: Editor | null = null;
  let syncing = false; // true while we replace the editor text ourselves
  const consoleEl = $('[data-pg-console]')!;
  const checkBtn = $<HTMLButtonElement>('[data-pg-check]');
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-pg-checks] > li'));

  const setDoc = (doc: string) => {
    syncing = true;
    editor?.setDoc(doc);
    syncing = false;
  };
  const clearConsole = () => {
    const empty = Object.assign(document.createElement('span'), { className: 'pg-empty', textContent: 'console.log output appears here' });
    consoleEl.replaceChildren(empty);
  };
  const log = (level: string, text: string) => {
    consoleEl.querySelector('.pg-empty')?.remove();
    consoleEl.append(Object.assign(document.createElement('div'), { className: `pg-log ${level}`, textContent: text }));
    while (consoleEl.children.length > 200) consoleEl.firstElementChild!.remove();
    consoleEl.scrollTop = consoleEl.scrollHeight;
  };

  const frame = createFrame($('[data-pg-screen]')!, (m) => {
    if (m.type === 'console') log(m.level, m.text);
    else if (m.type === 'error') log('error', `⛔ ${m.message}`);
    else if (m.type === 'check-result') showResults(m.results);
  });

  function showResults(results: CheckResult[]) {
    results.forEach((r, i) => {
      const li = items[i];
      if (!li) return;
      li.dataset.state = r.pass ? 'pass' : 'fail';
      li.querySelector('[data-detail]')!.textContent = r.pass ? '' : (r.detail ?? '');
    });
    root.classList.remove('is-checking');
    if (checkBtn) checkBtn.disabled = false;
    const sol = $<HTMLButtonElement>('[data-pg-sol]');
    if (sol) {
      sol.disabled = false;
      sol.removeAttribute('title');
    }
    const allPass = results.length > 0 && results.every((r) => r.pass);
    root.classList.toggle('is-passed', allPass);
    // progress tracking: every Check is saved with its score and code (only when signed in)
    const lab = root.closest<HTMLElement>('[data-lab]')?.dataset.lab;
    if (lab) record.attempt({ lab, exercise: def.id, passed: results.filter((r) => r.pass).length, total: results.length, files });
    if (allPass) {
      // solving the exercise ticks its task → updates the ring, tracker and session plan
      const box = root.closest('.task')?.querySelector<HTMLInputElement>('[data-task-check]');
      if (box && !box.checked) {
        box.checked = true;
        box.dispatchEvent(new Event('change'));
      }
    }
  }

  const run = () => {
    root.classList.remove('is-dirty');
    clearConsole();
    frame.send({ type: 'run', files });
  };
  const check = async () => {
    if (!checkBtn) return;
    checkBtn.disabled = true;
    await ensureIdentity(); // first Check: ask for name + ID (skipping still runs the check)
    root.classList.add('is-checking');
    root.classList.remove('is-dirty');
    items.forEach((li) => {
      li.dataset.state = 'running';
      li.querySelector('[data-detail]')!.textContent = '';
    });
    clearConsole();
    frame.send({ type: 'check', files, checks: def.checks });
  };
  const toggle = (btn: HTMLElement, box: HTMLElement) => {
    box.hidden = !box.hidden;
    btn.setAttribute('aria-expanded', String(!box.hidden));
  };

  $('[data-pg-run]')!.addEventListener('click', run);
  checkBtn?.addEventListener('click', check);
  $('[data-pg-reset]')?.addEventListener('click', () => {
    files = { ...def.files };
    save(def.id, null);
    setDoc(files[current]);
    root.classList.remove('is-passed');
    items.forEach((li) => {
      li.dataset.state = 'idle';
      li.querySelector('[data-detail]')!.textContent = '';
    });
    run();
  });
  const hint = $('[data-pg-hint]');
  hint?.addEventListener('click', () => toggle(hint, $('[data-pg-hint-box]')!));
  const sol = $('[data-pg-sol]');
  sol?.addEventListener('click', () => toggle(sol, $('[data-pg-solution]')!));
  root.querySelectorAll<HTMLButtonElement>('[data-pg-file]').forEach((tab) =>
    tab.addEventListener('click', () => {
      current = tab.dataset.pgFile!;
      root.querySelectorAll('[data-pg-file]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      setDoc(files[current]);
    }),
  );

  nearView(root, async () => {
    const { createEditor } = await import('./editor');
    const host = $('[data-pg-editor]')!;
    host.replaceChildren();
    editor = createEditor(host, files[current], {
      label: `Code editor: ${def.id}`,
      onRun: run,
      onChange: (doc) => {
        if (syncing || files[current] === doc) return;
        files = { ...files, [current]: doc };
        save(def.id, files);
        root.classList.add('is-dirty');
      },
    });
    root.classList.add('has-editor');
  });
  // demos start by themselves; exercises wait for Run
  if (!exercise) nearView(root, run, '0px');
}

function setupWalkthrough(root: HTMLElement) {
  const def = JSON.parse(root.querySelector('script[data-pg-def]')!.textContent!) as Def;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-aw-file]'));
  // '/recipe/3' and '/recipe/1' are the same screen
  const screenOf = (href: string) => href.split('?')[0].replace(/\/[^/]*\d[^/]*$/, '/:id');
  const select = (btn: HTMLButtonElement, navigate: boolean) => {
    buttons.forEach((b) => b.setAttribute('aria-current', String(b === btn)));
    root.querySelectorAll<HTMLElement>('[data-aw-pane]').forEach((p) => (p.hidden = p.dataset.awPane !== btn.dataset.awFile));
    if (navigate && btn.dataset.href) frame.send({ type: 'navigate', href: btn.dataset.href });
  };
  const frame = createFrame(root.querySelector('[data-pg-screen]')!, (m) => {
    if (m.type !== 'route') return;
    const current = root.querySelector<HTMLButtonElement>('[data-aw-file][aria-current="true"]');
    if (current?.dataset.href && screenOf(current.dataset.href) === screenOf(m.href)) return;
    const btn = buttons.find((b) => b.dataset.href && b.dataset.screen === 'true' && screenOf(b.dataset.href) === screenOf(m.href));
    if (btn) select(btn, false);
  });
  buttons.forEach((b) => b.addEventListener('click', () => select(b, true)));
  root.querySelector('[data-aw-restart]')?.addEventListener('click', () => frame.send({ type: 'run', files: def.files }));
  nearView(root, () => frame.send({ type: 'run', files: def.files }), '0px');
}

export function initPlaygrounds() {
  document.querySelectorAll<HTMLElement>('[data-playground]').forEach(setupPlayground);
  document.querySelectorAll<HTMLElement>('[data-walkthrough]').forEach(setupWalkthrough);
}
