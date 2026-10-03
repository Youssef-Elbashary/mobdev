/**
 * Code exercises and live demos: editor (file tabs) + live preview (phone or browser frame) + console.
 * The preview updates as you type; Check runs the exercise's checks against the running app.
 */
import { compileAll } from '../engine/compile.ts';
import { evaluate, lintFiles, type AppRunner } from '../engine/checks.ts';
import { LabPreview } from '../engine/preview.ts';
import type { CodeExercise, Demo } from '../exercises/types.ts';
import type { LabErrorInfo, LogLevel } from '../runtime/protocol.ts';
import { createEditor, type LabEditor } from './editor.ts';
import { debounce, h, md } from './dom.ts';
import { ExerciseShell } from './shell.ts';
import { loadExercise, saveExercise } from './store.ts';

type Options =
  | { mode: 'exercise'; lab: string; ex: CodeExercise; order: string[] }
  | { mode: 'demo'; lab: string; demo: Demo };

export class Workbench {
  private editor!: LabEditor;
  private preview!: LabPreview;
  private files: Record<string, string>;
  private starter: Record<string, string>;
  private paths: string[];
  private readOnly: Set<string>;
  private entry: string;
  private frame: 'phone' | 'web';
  private wb: HTMLElement;
  private tabs: HTMLElement;
  private errorBar: HTMLElement;
  private consoleList: HTMLOListElement;
  private consoleCount: HTMLElement;
  private shell: ExerciseShell | null = null;
  private runSeq = 0;
  private screen: HTMLElement;
  private asleep = false;

  constructor(
    host: HTMLElement,
    private opts: Options,
  ) {
    const src = opts.mode === 'exercise' ? opts.ex : opts.demo;
    this.starter = { ...src.files };
    this.entry = src.entry;
    this.frame = src.frame;
    this.readOnly = new Set(opts.mode === 'demo' ? (opts.demo.readOnly ?? []) : []);
    const saved = opts.mode === 'exercise' ? loadExercise(opts.lab, opts.ex.id).files : undefined;
    this.files = { ...this.starter, ...(saved ?? {}) };
    this.paths = Object.keys(this.starter);

    this.tabs = h('div', { class: 'wb-files', role: 'tablist', 'aria-label': 'Files' });
    this.errorBar = h('div', { class: 'wb-error', role: 'status', hidden: true });
    this.consoleList = h('ol', { class: 'wb-log' });
    this.consoleCount = h('span', { class: 'wb-log-n mono' });
    const editorHost = h('div', { class: 'wb-editor' });
    const screen = (this.screen = h('div', { class: 'wb-screen' }));
    const device =
      this.frame === 'phone'
        ? h('div', { class: 'wb-device' }, screen)
        : h('div', { class: 'wb-browser' }, h('div', { class: 'wb-bar', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('span', { class: 'mono' }, 'localhost:5173')), screen);

    const view = (which: 'code' | 'preview') => () => {
      this.wb.dataset.view = which;
      this.wb.querySelectorAll<HTMLButtonElement>('.wb-switch button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === which)));
    };

    this.wb = h(
      'div',
      { class: 'wb', 'data-frame': this.frame, 'data-view': 'code' },
      h('div', { class: 'wb-switch', role: 'tablist' }, h('button', { type: 'button', 'data-v': 'code', 'aria-selected': 'true', onclick: view('code') }, 'Code'), h('button', { type: 'button', 'data-v': 'preview', 'aria-selected': 'false', onclick: view('preview') }, 'Preview')),
      h('div', { class: 'wb-code' }, this.tabs, editorHost),
      h(
        'div',
        { class: 'wb-run' },
        device,
        this.errorBar,
        h('details', { class: 'wb-console', open: opts.mode === 'demo' && /useEffect|console\./.test(Object.values(this.starter).join('')) }, h('summary', {}, 'Console ', this.consoleCount), this.consoleList),
      ),
    );

    // build UI first, then the editor and preview inside it
    if (opts.mode === 'exercise') {
      const body = h('div', { class: 'ex-body' }, opts.ex.target ? h('figure', { class: 'ex-target' }, h('div', { html: opts.ex.target.html }), h('figcaption', { class: 'mono' }, opts.ex.target.caption)) : null, this.wb);
      this.shell = new ExerciseShell(host, {
        lab: opts.lab,
        ex: opts.ex,
        body,
        order: opts.order,
        checklist: opts.ex.checks.map((c) => ({ id: c.id, label: c.label })),
        onCheck: () => this.check(),
        onReset: () => this.reset(),
      });
    } else {
      const d = opts.demo;
      host.replaceChildren(
        h(
          'section',
          { class: 'demo-card', 'aria-label': `Live demo: ${d.title}` },
          h('header', { class: 'demo-head' }, h('span', { class: 'demo-k mono' }, '● LIVE DEMO'), h('h3', {}, d.title), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => this.reset() }, '↺ Reset')),
          d.tryThis?.length ? h('ul', { class: 'demo-try' }, ...d.tryThis.map((t) => h('li', { html: `<span class="mono">TRY</span> ${md(t)}` }))) : null,
          this.wb,
        ),
      );
    }

    this.editor = createEditor({
      parent: editorHost,
      frame: this.frame,
      allCode: () => Object.values(this.files).join('\n'),
      onChange: () => this.changed(),
    });
    for (const path of this.paths) this.editor.addFile(path, this.files[path], this.readOnly.has(path));
    this.renderTabs();
    this.editor.show(this.paths[0]);

    this.preview = this.newPreview();
    void this.refresh();
  }

  private newPreview() {
    return new LabPreview(this.screen, this.frame, {
      onLog: (level, text) => this.log(level, text),
      onError: (error) => this.showError(error),
    });
  }

  /** Free the preview iframe while this workbench is far off-screen. */
  sleep() {
    if (this.asleep) return;
    this.asleep = true;
    this.preview.destroy();
  }

  wake() {
    if (!this.asleep) return;
    this.asleep = false;
    this.preview = this.newPreview();
    void this.refresh();
  }

  private renderTabs() {
    this.tabs.replaceChildren(
      ...this.paths.map((path) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: 'wb-tab mono',
            'aria-selected': String(path === (this.editor?.current || this.paths[0])),
            onclick: () => {
              this.sync();
              this.editor.show(path);
              this.renderTabs();
              this.lint();
            },
          },
          path,
          this.readOnly.has(path) ? h('span', { class: 'wb-ro' }, 'read-only') : null,
        ),
      ),
    );
  }

  /** copy the open file from the editor into this.files */
  private sync() {
    const path = this.editor.current;
    if (path) this.files[path] = this.editor.read(path);
  }

  private save = debounce(() => {
    if (this.opts.mode !== 'exercise') return;
    saveExercise(this.opts.lab, this.opts.ex.id, { files: { ...this.files } });
  }, 400);

  private update = debounce(() => void this.refresh(), 450);

  private changed() {
    this.sync();
    this.save();
    this.update();
  }

  private lint() {
    const diagnostics = lintFiles(this.files).filter((d) => d.file === this.editor.current);
    this.editor.diagnose(diagnostics);
    return diagnostics;
  }

  /** Recompile and re-render the preview (keeps the last good render on syntax errors). */
  private async refresh() {
    const seq = ++this.runSeq;
    this.lint();
    const compiled = compileAll(this.files);
    if (!compiled.ok) {
      const e = compiled.errors[0];
      this.showError({ message: e.message, file: e.file, line: e.line }, 'Fix it to update the preview.');
      return;
    }
    this.consoleList.replaceChildren();
    this.updateCount();
    const result = await this.preview.run(compiled.files, this.entry, this.frame);
    if (seq !== this.runSeq) return;
    if (result.ok) this.hideError();
    else if (result.error) this.showError(result.error);
  }

  private showError(error: LabErrorInfo, extra?: string) {
    const where = error.file ? `<span class="mono">${error.file}${error.line ? ` · line ${error.line}` : ''}</span>` : '';
    this.errorBar.innerHTML = `<b>⚠ ${md(error.message)}</b>${where}${error.hint ? `<p>${md(error.hint)}</p>` : ''}${extra ? `<p>${md(extra)}</p>` : ''}`;
    this.errorBar.hidden = false;
    if (error.file && error.line && error.file === this.editor.current) {
      const existing = this.lint();
      if (!existing.some((d) => d.line === error.line)) this.editor.diagnose([...existing, { line: error.line, message: error.message }]);
    }
  }

  private hideError() {
    this.errorBar.hidden = true;
  }

  private log(level: LogLevel, text: string) {
    this.consoleList.append(h('li', { 'data-level': level }, text));
    while (this.consoleList.children.length > 60) this.consoleList.firstElementChild?.remove();
    this.consoleList.scrollTop = this.consoleList.scrollHeight;
    this.updateCount();
  }

  private updateCount() {
    const n = this.consoleList.children.length;
    this.consoleCount.textContent = n ? String(n) : '';
  }

  private async check() {
    if (this.opts.mode !== 'exercise') throw new Error('demos are not checked');
    this.sync();
    const runner: AppRunner = { run: (files, entry, frame) => this.preview.run(files, entry, frame), driver: this.preview };
    try {
      return await evaluate(this.opts.ex, { ...this.files }, runner);
    } finally {
      void this.refresh(); // show the student's app again in its fresh state
    }
  }

  reset() {
    const msg = this.opts.mode === 'exercise' ? 'Reset this exercise to the starter code? Your changes will be lost.' : 'Reset the demo code?';
    if (!confirm(msg)) return;
    this.files = { ...this.starter };
    for (const path of this.paths) this.editor.replace(path, this.files[path]);
    if (this.opts.mode === 'exercise') saveExercise(this.opts.lab, this.opts.ex.id, { files: undefined });
    this.shell?.renderChecklist(null);
    void this.refresh();
  }

  destroy() {
    this.preview?.destroy();
    this.editor?.destroy();
  }
}
