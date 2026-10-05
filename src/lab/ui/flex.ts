/**
 * Flexbox playground: move 3 boxes onto dashed target outlines by changing flexDirection /
 * justifyContent / alignItems. Shows the matching React Native style and NativeWind classes live.
 */
import { gradeFlex, gradeFlexRound } from '../engine/grade.ts';
import type { FlexExercise, FlexLayout } from '../exercises/types.ts';
import { h } from './dom.ts';
import { highlightHTML } from './highlight.ts';
import { ExerciseShell } from './shell.ts';
import { loadExercise, saveExercise } from './store.ts';

const OPTIONS: Record<keyof FlexLayout, string[]> = {
  flexDirection: ['column', 'row'],
  justifyContent: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
  alignItems: ['flex-start', 'center', 'flex-end'],
};
const NW: Record<string, string> = {
  column: 'flex-col', row: 'flex-row',
  'j:flex-start': 'justify-start', 'j:center': 'justify-center', 'j:flex-end': 'justify-end', 'j:space-between': 'justify-between', 'j:space-around': 'justify-around', 'j:space-evenly': 'justify-evenly',
  'a:flex-start': 'items-start', 'a:center': 'items-center', 'a:flex-end': 'items-end',
};
const START: FlexLayout = { flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start' };

type Saved = { round: number; layouts: FlexLayout[] };

export function mountFlex(host: HTMLElement, ex: FlexExercise, c: { lab: string; order: string[] }) {
  const saved = (loadExercise(c.lab, ex.id).answer as Saved | undefined) ?? { round: 0, layouts: [] };
  let round = Math.min(saved.round, ex.rounds.length - 1);
  let layouts: FlexLayout[] = saved.layouts;
  let layout: FlexLayout = layouts[round] ?? { ...START };

  const boxes = (cls: string) => ['A', 'B', 'C'].map((t, i) => h('i', { class: `fx-box ${cls} fx-${i}` }, cls === 'fx-solid' ? t : ''));
  const ghost = h('div', { class: 'fx-layer fx-ghost-layer', 'aria-hidden': 'true' }, ...boxes('fx-dash'));
  const live = h('div', { class: 'fx-layer' }, ...boxes('fx-solid'));
  const stage = h('div', { class: 'fx-stage', role: 'img', 'aria-label': 'Flexbox stage' }, ghost, live);
  const code = h('pre', { class: 'fx-code' });
  const roundEl = h('p', { class: 'fx-round mono' });
  const status = h('p', { class: 'fx-msg', 'aria-live': 'polite' });
  const controls = h('div', { class: 'fx-controls' });
  const next = h('button', { type: 'button', class: 'btn btn-primary btn-sm', hidden: true }, 'Next round →');

  const apply = (el: HTMLElement, l: FlexLayout) => {
    el.style.flexDirection = l.flexDirection;
    el.style.justifyContent = l.justifyContent;
    el.style.alignItems = l.alignItems;
  };

  const persist = () => {
    layouts = [...layouts];
    layouts[round] = layout;
    saveExercise(c.lab, ex.id, { answer: { round, layouts } satisfies Saved });
  };

  const render = () => {
    apply(live, layout);
    apply(ghost, ex.rounds[round]);
    roundEl.textContent = `ROUND ${round + 1} / ${ex.rounds.length}`;
    const nw = [NW[layout.flexDirection], NW[`j:${layout.justifyContent}`], NW[`a:${layout.alignItems}`]].join(' ');
    code.innerHTML = highlightHTML(`<View style={{\n  flexDirection: '${layout.flexDirection}',\n  justifyContent: '${layout.justifyContent}',\n  alignItems: '${layout.alignItems}',\n}}>\n\n// NativeWind:\n<View className="${nw}">`);
    controls.replaceChildren(
      ...(Object.keys(OPTIONS) as (keyof FlexLayout)[]).map((prop) =>
        h(
          'div',
          { class: 'fx-ctrl', role: 'radiogroup', 'aria-label': prop },
          h('span', { class: 'mono fx-prop' }, prop),
          h(
            'div',
            { class: 'fx-seg' },
            ...OPTIONS[prop].map((v) =>
              h(
                'button',
                {
                  type: 'button',
                  role: 'radio',
                  'aria-checked': String(layout[prop] === v),
                  onclick: () => {
                    layout = { ...layout, [prop]: v };
                    persist();
                    render();
                    evaluateRound();
                  },
                },
                v,
              ),
            ),
          ),
        ),
      ),
    );
  };

  const evaluateRound = () => {
    const r = gradeFlexRound(ex, round, layout);
    stage.classList.toggle('is-match', r.pass);
    next.hidden = !(r.pass && round < ex.rounds.length - 1);
    status.textContent = r.pass ? (round < ex.rounds.length - 1 ? '✓ Perfect fit! On to the next round.' : '✓ All rounds done — press Check.') : '';
  };

  next.addEventListener('click', () => {
    round += 1;
    layout = layouts[round] ?? { ...START };
    persist();
    render();
    evaluateRound();
  });

  render();
  evaluateRound();

  return new ExerciseShell(host, {
    lab: c.lab,
    ex,
    order: c.order,
    body: h('div', { class: 'ex-body fx' }, h('div', { class: 'fx-left' }, roundEl, stage, status, next), h('div', { class: 'fx-right' }, controls, code)),
    onCheck: async () => {
      const outcome = gradeFlex(ex, ex.rounds.map((_, i) => (i === round ? layout : layouts[i])));
      if (outcome.status !== 'pass') {
        const firstOpen = outcome.results.findIndex((r) => !r.pass);
        if (firstOpen >= 0 && firstOpen !== round && firstOpen < round) {
          round = firstOpen;
          layout = layouts[round] ?? { ...START };
          render();
          evaluateRound();
        }
      }
      return outcome;
    },
    onReset: () => {
      round = 0;
      layouts = [];
      layout = { ...START };
      saveExercise(c.lab, ex.id, { answer: undefined });
      render();
      evaluateRound();
    },
  });
}
