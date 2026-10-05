/**
 * Turns the placeholders rendered by <Exercise id>, <Demo id> and <LabStart> into live widgets.
 * Code workbenches (editor + preview iframe) are created only when scrolled near, and their preview
 * sleeps when far away, so 18 previews never run at once on a student laptop.
 */
import * as lab02 from '../exercises/lab-02/index.ts';
import type { Exercise } from '../exercises/types.ts';
import { mountFlex } from './flex.ts';
import { initProgress } from './progress.ts';
import { startTracker } from './tracker.ts';
import { mountLabel, mountMatch, mountOrder, mountPredict } from './widgets.ts';
import { Workbench } from './workbench.ts';

const LABS = { 'lab-02': lab02 } as const;

export function mountLab(): (() => void) | undefined {
  const root = document.querySelector<HTMLElement>('[data-lab-interactive]');
  const id = root?.dataset.labInteractive as keyof typeof LABS | undefined;
  if (!root || !id || !LABS[id]) return;
  const reg = LABS[id];
  const lab = reg.LAB_ID;
  const order = reg.exercises.map((e) => e.id);
  const cleanups: (() => void)[] = [];

  startTracker(lab);
  cleanups.push(initProgress(lab, reg.EXERCISES, reg.BLOCKS));

  const benches = new Map<Element, Workbench>();
  if (import.meta.env.DEV) (window as unknown as { __labBenches: typeof benches }).__labBenches = benches;
  const create = (el: HTMLElement) => {
    if (benches.has(el)) return;
    try {
      if (el.dataset.exercise) {
        const ex = reg.byId(el.dataset.exercise) as Extract<Exercise, { kind: 'code' | 'fix' }>;
        benches.set(el, new Workbench(el, { mode: 'exercise', lab, ex, order }));
      } else if (el.dataset.demo) {
        const demo = reg.demos[el.dataset.demo];
        if (demo) benches.set(el, new Workbench(el, { mode: 'demo', lab, demo }));
      }
    } catch (error) {
      console.error('[lab] could not start this workbench', error);
      el.querySelector('.ex-loading')?.replaceChildren('Couldn’t load this exercise — refresh the page.');
    }
  };

  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const bench = benches.get(e.target);
        if (e.isIntersecting) bench ? bench.wake() : create(e.target as HTMLElement);
        else bench?.sleep();
      }
    },
    { rootMargin: '900px 0px' },
  );

  for (const el of document.querySelectorAll<HTMLElement>('[data-exercise]')) {
    const ex = reg.byId(el.dataset.exercise!);
    if (!ex) continue;
    const common = { lab, order };
    switch (ex.kind) {
      case 'code':
      case 'fix':
        near.observe(el);
        break;
      case 'order':
        mountOrder(el, ex, common);
        break;
      case 'match':
        mountMatch(el, ex, common);
        break;
      case 'label':
        mountLabel(el, ex, common);
        break;
      case 'predict':
        mountPredict(el, ex, common);
        break;
      case 'flex':
        mountFlex(el, ex, common);
        break;
    }
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-demo]')) near.observe(el);

  cleanups.push(() => {
    near.disconnect();
    for (const b of benches.values()) b.destroy();
    benches.clear();
  });
  return () => cleanups.forEach((fn) => fn());
}
