/**
 * The frame every exercise shares: header (number, level, time, status), task, live checklist,
 * Check / Reset / Hint / Prev / Next, teaching feedback and progressive hints.
 */
import type { Outcome } from '../engine/checks.ts';
import type { Exercise } from '../exercises/types.ts';
import { h, md } from './dom.ts';
import { getStudent, loadExercise, saveExercise, type ExerciseState } from './store.ts';
import { track } from './tracker.ts';

export type ShellOptions = {
  lab: string;
  ex: Exercise;
  body: HTMLElement;
  /** checklist labels (code exercises) */
  checklist?: { id: string; label: string }[];
  onCheck: () => Promise<Outcome>;
  onReset?: () => void;
  /** ids of all exercises in order, for Prev / Next */
  order: string[];
  checkLabel?: string;
};

const STATUS_TEXT = (s: ExerciseState) =>
  s.status === 'solved' ? 'Solved' : s.status === 'trying' ? `Trying · ${s.attempts} ${s.attempts === 1 ? 'try' : 'tries'}` : 'Not started';

export class ExerciseShell {
  root: HTMLElement;
  private statusEl: HTMLElement;
  private checklistEl: HTMLUListElement | null = null;
  private feedbackEl: HTMLElement;
  private hintsEl: HTMLOListElement;
  private hintBtn: HTMLButtonElement;
  checkBtn: HTMLButtonElement;
  private busy = false;

  constructor(
    host: HTMLElement,
    private opts: ShellOptions,
  ) {
    const { ex } = opts;
    const state = loadExercise(opts.lab, ex.id);

    this.statusEl = h('span', { class: 'ex-status', 'data-status': state.status }, STATUS_TEXT(state));
    this.feedbackEl = h('div', { class: 'ex-feedback', 'aria-live': 'polite' });
    this.hintsEl = h('ol', { class: 'ex-hints' });
    this.hintBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => this.revealHint() });
    this.checkBtn = h('button', { class: 'btn btn-primary btn-sm ex-check', type: 'button', onclick: () => void this.check() }, opts.checkLabel ?? 'Check');

    if (opts.checklist?.length) {
      this.checklistEl = h('ul', { class: 'ex-checklist', 'aria-label': 'Requirements' }, ...opts.checklist.map((c) => h('li', { 'data-check': c.id }, h('i', { 'aria-hidden': 'true' }), h('span', { html: md(c.label) }))));
    }

    const index = opts.order.indexOf(ex.id);
    const go = (offset: number) => () => document.getElementById(`ex-${opts.order[index + offset]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    this.root = h(
      'section',
      { class: `ex-card ex-${ex.kind}`, 'aria-labelledby': `ex-${ex.id}-title` },
      h(
        'header',
        { class: 'ex-head' },
        h('span', { class: 'ex-num mono' }, `EX ${String(ex.n).padStart(2, '0')}`),
        ex.level ? h('span', { class: 'ex-level mono' }, `Level ${ex.level}`) : null,
        h('h3', { class: 'ex-title', id: `ex-${ex.id}-title` }, ex.title),
        h('span', { class: 'ex-time mono' }, `⏱ ${ex.minutes} min`),
        this.statusEl,
      ),
      h('p', { class: 'ex-prompt', html: md(ex.prompt) }),
      this.checklistEl,
      opts.body,
      h(
        'div',
        { class: 'ex-actions' },
        this.checkBtn,
        opts.onReset ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => opts.onReset!() }, '↺ Reset') : null,
        this.hintBtn,
        h('span', { class: 'ex-spacer' }),
        index > 0 ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: go(-1), 'aria-label': 'Previous exercise' }, '← Prev') : null,
        index < opts.order.length - 1 ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: go(1), 'aria-label': 'Next exercise' }, 'Next →') : null,
      ),
      this.feedbackEl,
      this.hintsEl,
    );
    host.replaceChildren(this.root);
    for (let i = 0; i < Math.min(state.hints, ex.hints.length); i++) this.appendHint(i);
    this.updateHintButton(state.hints);
    if (state.status === 'solved') this.root.classList.add('is-solved');
  }

  private appendHint(i: number) {
    this.hintsEl.append(h('li', { class: 'ex-hint' }, h('span', { class: 'mono' }, `Hint ${i + 1}`), h('span', { html: md(this.opts.ex.hints[i]) })));
  }

  private updateHintButton(shown: number) {
    const total = this.opts.ex.hints.length;
    this.hintBtn.textContent = shown >= total ? 'All hints shown' : `💡 Hint ${shown + 1} of ${total}`;
    this.hintBtn.disabled = shown >= total;
  }

  revealHint() {
    const { lab, ex } = this.opts;
    const state = loadExercise(lab, ex.id);
    if (state.hints >= ex.hints.length) return;
    this.appendHint(state.hints);
    const next = saveExercise(lab, ex.id, { hints: state.hints + 1, status: state.status === 'new' ? 'trying' : state.status });
    this.updateHintButton(next.hints);
    this.renderStatus(next);
    track({ lab, event: 'hint', exercise: ex.id });
  }

  renderStatus(state: ExerciseState) {
    this.statusEl.dataset.status = state.status;
    this.statusEl.textContent = STATUS_TEXT(state);
    this.root.classList.toggle('is-solved', state.status === 'solved');
  }

  /** Mark checklist items from an outcome (or clear them with null). */
  renderChecklist(outcome: Outcome | null) {
    if (!this.checklistEl) return;
    for (const li of this.checklistEl.querySelectorAll<HTMLElement>('li')) {
      const r = outcome?.results.find((x) => x.id === li.dataset.check);
      li.dataset.state = r ? (r.pass ? 'pass' : 'fail') : '';
    }
  }

  showMessage(html: string, tone: 'info' | 'warn' = 'info') {
    this.feedbackEl.innerHTML = `<div class="fb fb-${tone}">${html}</div>`;
  }

  renderOutcome(outcome: Outcome) {
    const { ex } = this.opts;
    const failing = outcome.results.filter((r) => !r.pass);
    const passed = outcome.results.length - failing.length;
    const blocker = outcome.blocker
      ? `<p class="fb-block">⚠ ${md(outcome.blocker.message)}${outcome.blocker.line ? ` <span class="mono">(${outcome.blocker.file ?? ''} line ${outcome.blocker.line})</span>` : ''}${outcome.blocker.hint ? `<br>${md(outcome.blocker.hint)}` : ''}</p>`
      : '';
    let html: string;
    if (outcome.status === 'pass') {
      const notes = outcome.results.filter((r) => r.message).map((r) => `<li>${md(r.message!)}</li>`).join('');
      html = `<div class="fb fb-pass"><b class="fb-t">✓ Correct!</b><p>${md(ex.success)}</p>${notes ? `<ul>${notes}</ul>` : ''}${
        ex.challenge ? `<p class="fb-challenge"><span class="mono">MINI CHALLENGE</span> ${md(ex.challenge)}</p>` : ''
      }</div>`;
    } else if (outcome.status === 'partial') {
      html = `<div class="fb fb-partial"><b class="fb-t">Almost — ${passed} of ${outcome.results.length} done.</b>${blocker}<ul>${failing
        .map((r) => `<li>${md(r.message ?? r.label)}</li>`)
        .join('')}</ul></div>`;
    } else {
      const first = failing[0];
      html = `<div class="fb fb-fail"><b class="fb-t">Not yet.</b>${blocker}${first && !outcome.blocker ? `<p>${md(first.message ?? first.label)}</p>` : ''}<p class="fb-tip">Stuck? Open a hint — they unlock one at a time.</p></div>`;
    }
    this.feedbackEl.innerHTML = html;
  }

  async check() {
    if (this.busy) return;
    const { lab, ex } = this.opts;
    const practice = this.root.closest<HTMLElement>('[data-lab]')?.dataset.sessionAccess === 'practice';
    if (!getStudent() && !practice) {
      this.showMessage('Enter your <b>name</b> and <b>student ID</b> at the top of the lab first, so your progress counts. <a href="#lab-start">Go to sign in ↑</a>', 'warn');
      return;
    }
    this.busy = true;
    const label = this.checkBtn.textContent;
    this.checkBtn.disabled = true;
    this.checkBtn.textContent = 'Checking…';
    try {
      const outcome = await this.opts.onCheck();
      const prev = loadExercise(lab, ex.id);
      const solved = outcome.status === 'pass';
      const state = saveExercise(lab, ex.id, {
        attempts: prev.attempts + 1,
        status: solved || prev.status === 'solved' ? 'solved' : 'trying',
        best: Math.max(prev.best, outcome.score),
        ...(solved && !prev.solvedAt ? { solvedAt: Date.now() } : null),
      });
      track({ lab, event: 'check', exercise: ex.id, result: outcome.status, score: Math.round(outcome.score * 100) / 100 });
      this.renderChecklist(outcome);
      this.renderOutcome(outcome);
      this.renderStatus(state);
      if (solved && prev.status !== 'solved') {
        this.root.classList.remove('just-solved');
        void this.root.offsetWidth;
        this.root.classList.add('just-solved');
      }
    } catch (error) {
      console.error('[lab] check failed', error);
      this.showMessage('Something went wrong while checking. Try again in a moment.', 'warn');
    } finally {
      this.busy = false;
      this.checkBtn.disabled = false;
      this.checkBtn.textContent = label;
    }
  }
}
