/** Non-code exercises: order, match, label (a mock screen), predict. All use the shared ExerciseShell. */
import { gradeLabel, gradeMatch, gradeOrder, gradePredict } from '../engine/grade.ts';
import type { LabelExercise, MatchExercise, OrderExercise, PredictExercise } from '../exercises/types.ts';
import { clearPick, draggable, dropPicked, isPicking } from './dnd.ts';
import { h, md, shuffle } from './dom.ts';
import { highlightHTML } from './highlight.ts';
import { ExerciseShell } from './shell.ts';
import { loadExercise, saveExercise } from './store.ts';

type Common = { lab: string; order: string[] };

/* ------------------------------------------------------------------ order */

export function mountOrder(host: HTMLElement, ex: OrderExercise, c: Common) {
  const saved = loadExercise(c.lab, ex.id).answer as string[] | undefined;
  let order = saved && saved.length === ex.items.length && saved.every((s) => ex.items.includes(s)) ? saved : shuffle(ex.items, ex.id);
  const list = h('ol', { class: `ord${ex.mono ? ' is-mono' : ''}`, 'aria-label': 'Drag to reorder' });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    order = next;
    saveExercise(c.lab, ex.id, { answer: order });
    render(order[to]);
  };

  const render = (focusText?: string) => {
    list.replaceChildren(
      ...order.map((text, i) => {
        const handle = h('button', { type: 'button', class: 'ord-grip', 'aria-label': `Move: ${text.replace(/`/g, '')}` }, '⋮⋮');
        const row = h(
          'li',
          { class: 'ord-row', 'data-drop': String(i), 'data-i': String(i) },
          handle,
          h('span', { class: 'ord-n mono' }, String(i + 1)),
          h('span', { class: 'ord-t', html: ex.mono ? highlightHTML(text) : md(text) }),
          h(
            'span',
            { class: 'ord-arrows' },
            h('button', { type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, i - 1) }, '↑'),
            h('button', { type: 'button', 'aria-label': 'Move down', disabled: i === order.length - 1, onclick: () => move(i, i + 1) }, '↓'),
          ),
        );
        row.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('.ord-arrows, .ord-grip')) return;
          dropPicked(row);
        });
        draggable(handle, { scope: list, onDrop: (target) => move(i, Number(target.dataset.i)) });
        return row;
      }),
    );
    if (focusText) (list.children[order.indexOf(focusText)]?.querySelector('.ord-grip') as HTMLElement | null)?.focus();
  };
  render();

  const shell = new ExerciseShell(host, {
    lab: c.lab,
    ex,
    order: c.order,
    body: h('div', { class: 'ex-body' }, h('p', { class: 'ex-how mono' }, 'Drag the ⋮⋮ handle · or tap a handle, then tap the row it goes before · or use ↑ ↓'), list),
    onCheck: async () => {
      const outcome = gradeOrder(ex, order);
      outcome.results.forEach((r, i) => list.children[i]?.setAttribute('data-state', r.pass ? 'pass' : 'fail'));
      return outcome;
    },
    onReset: () => {
      order = shuffle(ex.items, ex.id);
      saveExercise(c.lab, ex.id, { answer: undefined });
      render();
    },
  });
  return shell;
}

/* ------------------------------------------------------------------ match */

export function mountMatch(host: HTMLElement, ex: MatchExercise, c: Common) {
  const chips = shuffle([...ex.pairs.map((p) => p.chip), ...(ex.decoys ?? []).map((d) => d.chip)], ex.id);
  const targets = shuffle(ex.pairs.map((p) => p.target), `${ex.id}-t`);
  let placed: Record<string, string | undefined> = { ...((loadExercise(c.lab, ex.id).answer as Record<string, string>) ?? {}) };

  const pool = h('div', { class: 'mt-pool', 'data-drop': 'pool', 'aria-label': 'Chips' });
  const rows = h('div', { class: 'mt-rows' });
  const scope = h('div', { class: 'mt' }, pool, rows);

  const place = (chip: string, target: string | 'pool') => {
    for (const t of Object.keys(placed)) if (placed[t] === chip) placed[t] = undefined;
    if (target !== 'pool') placed[target] = chip;
    saveExercise(c.lab, ex.id, { answer: placed });
    render();
  };

  const chipEl = (chip: string) => {
    const el = h('button', { type: 'button', class: `chip-d${ex.mono ? ' mono' : ''}` }, chip);
    draggable(el, { scope, onDrop: (t) => place(chip, t.dataset.drop === 'pool' ? 'pool' : t.dataset.target!) });
    return el;
  };

  const render = () => {
    const used = new Set(Object.values(placed).filter(Boolean));
    pool.replaceChildren(...chips.filter((ch) => !used.has(ch)).map(chipEl));
    if (!pool.children.length) pool.append(h('span', { class: 'mt-empty mono' }, 'all placed — press Check'));
    rows.replaceChildren(
      ...targets.map((t) => {
        const slot = h('div', { class: 'mt-slot', 'data-drop': 'slot', 'data-target': t, tabindex: '0', role: 'button', 'aria-label': `Drop zone: ${t.replace(/`/g, '')}` });
        const chip = placed[t];
        if (chip) slot.append(chipEl(chip));
        else slot.append(h('span', { class: 'mt-hole mono' }, 'drop here'));
        const drop = () => isPicking() && dropPicked(slot);
        slot.addEventListener('click', (e) => {
          if (e.target === slot || (e.target as HTMLElement).classList.contains('mt-hole')) drop();
        });
        slot.addEventListener('keydown', (e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === slot) {
            e.preventDefault();
            drop();
          }
        });
        return h('div', { class: 'mt-row' }, h('p', { class: 'mt-desc', html: md(t) }), slot);
      }),
    );
  };
  pool.addEventListener('click', (e) => {
    if (e.target === pool) dropPicked(pool);
  });
  render();

  return new ExerciseShell(host, {
    lab: c.lab,
    ex,
    order: c.order,
    body: h('div', { class: 'ex-body' }, h('p', { class: 'ex-how mono' }, 'Drag a chip onto its line · or tap a chip, then tap the line'), scope),
    onCheck: async () => {
      const outcome = gradeMatch(ex, placed);
      for (const slot of rows.querySelectorAll<HTMLElement>('.mt-slot')) {
        const r = outcome.results.find((x) => x.label === slot.dataset.target);
        slot.dataset.state = r ? (r.pass ? 'pass' : 'fail') : '';
      }
      return outcome;
    },
    onReset: () => {
      placed = {};
      clearPick();
      saveExercise(c.lab, ex.id, { answer: undefined });
      render();
    },
  });
}

/* ------------------------------------------------------------------ label */

const SHOP_SCREEN = `
  <div class="ms-header" data-zone="header"><b>🛒 Shop</b><span>🧺 2</span></div>
  <div class="ms-search" data-zone="search">🔍 Search products</div>
  <div class="ms-grid">
    <div class="ms-card" data-zone="card1"><div class="ms-img">🎧</div><b>Headphones</b><span>EGP 1,200</span><i>Add</i></div>
    <div class="ms-card" data-zone="card2"><div class="ms-img">⌚</div><b>Smart watch</b><span>EGP 2,500</span><i>Add</i></div>
  </div>
  <div class="ms-tabs" data-zone="tabs"><span>🏠<br>Home</span><span>❤️<br>Saved</span><span>👤<br>Me</span></div>`;

export function mountLabel(host: HTMLElement, ex: LabelExercise, c: Common) {
  let placed: Record<string, string | undefined> = { ...((loadExercise(c.lab, ex.id).answer as Record<string, string>) ?? {}) };
  const screen = h('div', { class: 'ms', 'data-zone': 'screen', html: SHOP_SCREEN });
  const pool = h('div', { class: 'lb-pool' });
  const scope = h('div', { class: 'lb' }, h('div', { class: 'lb-phone' }, screen), h('div', { class: 'lb-side' }, h('p', { class: 'mono lb-k' }, 'COMPONENTS'), pool));

  const zones = [screen, ...screen.querySelectorAll<HTMLElement>('[data-zone]')];
  const assign = (zoneId: string, chip: string | undefined) => {
    placed[zoneId] = chip;
    saveExercise(c.lab, ex.id, { answer: placed });
    render();
  };

  for (const z of zones) {
    z.setAttribute('data-drop', z.dataset.zone!);
    z.setAttribute('tabindex', '0');
    z.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-zone]') !== z) return;
      if (isPicking()) dropPicked(z);
    });
    z.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === z && isPicking()) {
        e.preventDefault();
        dropPicked(z);
      }
    });
  }

  const render = () => {
    pool.replaceChildren(
      ...ex.chips.map((chip) => {
        const el = h('button', { type: 'button', class: 'chip-d mono' }, `<${chip} />`);
        draggable(el, { scope, onDrop: (t) => t.dataset.zone && assign(t.dataset.zone, chip) });
        return el;
      }),
    );
    for (const z of zones) {
      z.querySelector(':scope > .lb-tag')?.remove();
      const chip = placed[z.dataset.zone!];
      const tag = h('button', { type: 'button', class: `lb-tag mono${chip ? '' : ' is-empty'}`, title: chip ? 'Tap to remove' : 'Drop a component here', onclick: (e: Event) => { e.stopPropagation(); if (chip) assign(z.dataset.zone!, undefined); else if (isPicking()) dropPicked(z); } }, chip ? `<${chip} />` : '?');
      z.prepend(tag);
    }
  };
  render();

  return new ExerciseShell(host, {
    lab: c.lab,
    ex,
    order: c.order,
    body: h('div', { class: 'ex-body' }, h('p', { class: 'ex-how mono' }, 'Drag a name onto a part of the screen (the outer frame = the whole screen) · or tap a name, then tap a part'), scope),
    onCheck: async () => {
      const outcome = gradeLabel(ex, placed);
      for (const z of zones) {
        const r = outcome.results.find((x) => x.id === z.dataset.zone);
        z.dataset.state = r ? (r.pass ? 'pass' : 'fail') : '';
      }
      return outcome;
    },
    onReset: () => {
      placed = {};
      clearPick();
      saveExercise(c.lab, ex.id, { answer: undefined });
      zones.forEach((z) => (z.dataset.state = ''));
      render();
    },
  });
}

/* ------------------------------------------------------------------ predict */

export function mountPredict(host: HTMLElement, ex: PredictExercise, c: Common) {
  let answers: number[] = (loadExercise(c.lab, ex.id).answer as number[]) ?? ex.questions.map(() => -1);
  const groups = ex.questions.map((q, qi) => {
    const options = h(
      'div',
      { class: 'pr-opts', role: 'radiogroup', 'aria-label': `Question ${qi + 1}` },
      ...q.options.map((o, oi) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            class: 'pr-opt',
            'aria-checked': String(answers[qi] === oi),
            onclick: () => {
              answers = answers.map((a, i) => (i === qi ? oi : a));
              saveExercise(c.lab, ex.id, { answer: answers });
              options.querySelectorAll('.pr-opt').forEach((b, bi) => {
                b.setAttribute('aria-checked', String(bi === oi));
                b.removeAttribute('data-state');
              });
            },
          },
          o.text,
        ),
      ),
    );
    return { el: h('div', { class: 'pr-q' }, h('pre', { class: 'pr-code', html: highlightHTML(q.code) }), h('p', { class: 'pr-ask', html: md(q.question) }), options), options };
  });

  return new ExerciseShell(host, {
    lab: c.lab,
    ex,
    order: c.order,
    body: h('div', { class: 'ex-body pr' }, ...groups.map((g) => g.el)),
    onCheck: async () => {
      const outcome = gradePredict(ex, answers);
      groups.forEach((g, qi) => {
        g.options.querySelectorAll<HTMLElement>('.pr-opt').forEach((b, oi) => {
          b.dataset.state = oi === answers[qi] ? (outcome.results[qi].pass ? 'pass' : 'fail') : '';
        });
      });
      return outcome;
    },
  });
}
