/**
 * Keeps every progress indicator in sync with solved exercises: the sticky bar (block, exercise n/17,
 * %, one square per exercise), the header ring, the session-plan bar and the completion banner.
 */
import type { ExerciseMeta } from '../exercises/lab-02/meta.ts';
import { loadAll } from './store.ts';

type Block = { n: number; part: number; title: string };

export function initProgress(lab: string, meta: ExerciseMeta[], blocks: readonly Block[]) {
  const bar = document.querySelector<HTMLElement>('[data-lab-progress]');
  const ids = meta.map((m) => m.id);

  const paint = () => {
    const states = loadAll(lab, ids);
    const solved = ids.filter((id) => states[id].status === 'solved').length;
    const p = ids.length ? solved / ids.length : 0;

    document.querySelectorAll<HTMLElement>('[data-sq]').forEach((sq) => (sq.dataset.state = states[sq.dataset.sq!]?.status ?? 'new'));
    document.querySelectorAll('[data-lp-pct], [data-pct]').forEach((el) => (el.textContent = String(Math.round(p * 100))));
    document.querySelectorAll('[data-done]').forEach((el) => (el.textContent = String(solved)));
    document.querySelector<HTMLElement>('[data-lp-fill]')?.style.setProperty('--p', String(p));
    const ring = document.querySelector<SVGCircleElement>('[data-ring]');
    if (ring) ring.style.strokeDashoffset = String(100 - p * 100);
    document.querySelectorAll<HTMLAnchorElement>('[data-plan-part]').forEach((a) => {
      const inBlock = meta.filter((m) => String(m.block) === a.dataset.planPart);
      const done = inBlock.filter((m) => states[m.id].status === 'solved').length;
      a.style.setProperty('--p', String(inBlock.length ? done / inBlock.length : 0));
    });
    const banner = document.querySelector<HTMLElement>('[data-lab-complete]');
    if (banner) banner.hidden = solved !== ids.length;
  };

  // which block / exercise is on screen
  const where = () => {
    if (!bar) return;
    const mid = window.innerHeight * 0.35;
    let block = blocks[0];
    for (const b of blocks) {
      const el = document.getElementById(`part-${b.n}`);
      if (el && el.getBoundingClientRect().top < mid) block = b;
    }
    let ex = meta[0];
    for (const m of meta) {
      const el = document.getElementById(`ex-${m.id}`);
      if (el && el.getBoundingClientRect().top < mid) ex = m;
    }
    bar.querySelector('[data-lp-where]')!.textContent = `Part ${block.part} · Block ${block.n}/${blocks.length}`;
    bar.querySelector('[data-lp-title]')!.textContent = block.title;
    bar.querySelector('[data-lp-ex]')!.textContent = `Ex ${ex.n}/${meta.length}`;
    document.querySelectorAll<HTMLElement>('[data-sq]').forEach((sq) => sq.classList.toggle('is-here', sq.dataset.sq === ex.id));
  };

  // show the sticky bar once the lab header has scrolled away
  const head = document.querySelector('.lab-head');
  let io: IntersectionObserver | null = null;
  if (bar && head) {
    io = new IntersectionObserver(([entry]) => bar.classList.toggle('is-on', !entry.isIntersecting), { rootMargin: '-80px 0px 0px 0px' });
    io.observe(head);
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      where();
    });
  };

  window.addEventListener('lab:progress', paint);
  window.addEventListener('scroll', onScroll, { passive: true });
  paint();
  where();

  return () => {
    io?.disconnect();
    window.removeEventListener('lab:progress', paint);
    window.removeEventListener('scroll', onScroll);
  };
}
