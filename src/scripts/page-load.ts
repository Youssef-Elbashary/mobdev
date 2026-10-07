/**
 * Runs a page initializer once for the current <main>, both on a direct browser load and after
 * an Astro client-side navigation. Astro's initial `astro:page-load` event can fire before a
 * page's bundled script subscribes, so listening to that event alone can leave the page inert.
 */
export function onPageLoad(init: () => void | Promise<void>): void {
  let initializedMain: Element | null = null;

  const run = () => {
    const currentMain = document.querySelector('main');
    if (!currentMain || currentMain === initializedMain) return;
    initializedMain = currentMain;
    void init();
  };

  document.addEventListener('astro:page-load', run);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else queueMicrotask(run);
}
