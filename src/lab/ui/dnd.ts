/**
 * Drag and drop that works with a mouse, a finger, AND without dragging at all:
 * tap/click (or Enter/Space) a chip to pick it, then tap the place it goes.
 * Drop targets are elements with [data-drop].
 */
let picked: { el: HTMLElement; drop: (target: HTMLElement) => void } | null = null;

export function clearPick() {
  picked?.el.classList.remove('is-picked');
  picked = null;
  document.querySelectorAll('.can-drop').forEach((e) => e.classList.remove('can-drop'));
}

/** Call from a drop target's click/Enter handler: drops the picked chip there. Returns true if it did. */
export function dropPicked(target: HTMLElement): boolean {
  if (!picked) return false;
  const p = picked;
  clearPick();
  p.drop(target);
  return true;
}

export const isPicking = () => picked !== null;

export function draggable(el: HTMLElement, opts: { onDrop: (target: HTMLElement) => void; scope: HTMLElement }) {
  el.classList.add('dnd-item');
  const pick = () => {
    if (picked?.el === el) return clearPick();
    clearPick();
    picked = { el, drop: opts.onDrop };
    el.classList.add('is-picked');
    opts.scope.querySelectorAll('[data-drop]').forEach((t) => t.classList.add('can-drop'));
  };

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick();
    } else if (e.key === 'Escape') clearPick();
  });

  el.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return;
    const rect = el.getBoundingClientRect();
    const offX = down.clientX - rect.left;
    const offY = down.clientY - rect.top;
    let ghost: HTMLElement | null = null;
    let over: HTMLElement | null = null;
    let scrollTimer: ReturnType<typeof setInterval> | undefined;
    let lastY = down.clientY;

    const move = (ev: PointerEvent) => {
      if (!ghost && Math.hypot(ev.clientX - down.clientX, ev.clientY - down.clientY) < 6) return;
      if (!ghost) {
        clearPick();
        ghost = el.cloneNode(true) as HTMLElement;
        ghost.classList.add('dnd-ghost');
        ghost.style.width = `${rect.width}px`;
        document.body.appendChild(ghost);
        el.classList.add('is-dragging');
        opts.scope.querySelectorAll('[data-drop]').forEach((t) => t.classList.add('can-drop'));
        scrollTimer = setInterval(() => {
          if (lastY < 70) window.scrollBy(0, -12);
          else if (lastY > window.innerHeight - 70) window.scrollBy(0, 12);
        }, 16);
      }
      ev.preventDefault();
      lastY = ev.clientY;
      ghost.style.transform = `translate(${ev.clientX - offX}px, ${ev.clientY - offY}px)`;
      const under = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]') ?? null;
      const target = under && opts.scope.contains(under) ? under : null;
      if (target !== over) {
        over?.classList.remove('is-over');
        target?.classList.add('is-over');
        over = target;
      }
    };

    const finish = (ev: PointerEvent, cancelled: boolean) => {
      el.removeEventListener('pointermove', move);
      clearInterval(scrollTimer);
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {
        /* already released */
      }
      if (ghost) {
        ghost.remove();
        el.classList.remove('is-dragging');
        over?.classList.remove('is-over');
        opts.scope.querySelectorAll('.can-drop').forEach((t) => t.classList.remove('can-drop'));
        if (over && !cancelled) opts.onDrop(over);
      } else if (!cancelled) {
        pick();
      }
    };

    el.setPointerCapture(down.pointerId);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', (e) => finish(e, false), { once: true });
    el.addEventListener('pointercancel', (e) => finish(e, true), { once: true });
  });
}
