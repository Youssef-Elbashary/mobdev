/** Runs a check's steps against the rendered app, the way a student would use it. */
import type { Check, CheckResult, Step } from './protocol.ts';

export type CheckCtx = { source: string; settle: () => Promise<void>; error: () => string | null };

export const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The element with this testID, else the innermost element whose text matches. */
export function findByText(root: Element, text: string, exact = true): HTMLElement | null {
  const byId = root.querySelector<HTMLElement>(`[data-testid="${CSS.escape(text)}"]`);
  if (byId) return byId;
  const want = normalize(text);
  const hits = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) => {
    const t = normalize(el.textContent ?? '');
    return exact ? t === want : t.includes(want);
  });
  return hits.find((el) => !hits.some((o) => o !== el && el.contains(o))) ?? null;
}

export function findInput(root: Element, key: string) {
  return (
    Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')).find(
      (i) => i.placeholder === key || i.dataset.testid === key || i.getAttribute('aria-label') === key,
    ) ?? null
  );
}

function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const hasText = (root: Element, text: string, exact = false) =>
  exact ? !!findByText(root, text, true) : normalize(root.textContent ?? '').includes(normalize(text));

async function runStep(root: HTMLElement, step: Step, ctx: CheckCtx): Promise<string | null> {
  if ('press' in step) {
    const el = findByText(root, step.press) ?? findByText(root, step.press, false);
    if (!el) return `Couldn't find "${step.press}" to tap.`;
    el.click();
    await ctx.settle();
    return null;
  }
  if ('type' in step) {
    const el = findInput(root, step.into);
    if (!el) return `Couldn't find a TextInput with placeholder "${step.into}".`;
    typeInto(el, step.type);
    await ctx.settle();
    return null;
  }
  if ('expectText' in step) return hasText(root, step.expectText, step.exact) ? null : `Expected to see "${step.expectText}".`;
  if ('expectNoText' in step) return hasText(root, step.expectNoText, step.exact) ? `"${step.expectNoText}" should not be on the screen.` : null;
  if ('expectFocused' in step) {
    const el = findInput(root, step.expectFocused);
    return el && root.ownerDocument.activeElement === el ? null : `The "${step.expectFocused}" input should have focus.`;
  }
  if ('expectStyle' in step) {
    const { text, prop, includes } = step.expectStyle;
    let el: HTMLElement | null = findByText(root, text, false);
    if (!el) return `Expected to see "${text}".`;
    for (let i = 0; el && i < 4; i++, el = el.parentElement) {
      if (getComputedStyle(el).getPropertyValue(prop).includes(includes)) return null;
    }
    return `"${text}" should have ${prop}: ${includes}.`;
  }
  if ('expectCode' in step) return new RegExp(step.expectCode, step.flags ?? '').test(ctx.source) ? null : step.message;
  if ('wait' in step) {
    await sleep(step.wait);
    return null;
  }
  return 'Unknown check step.';
}

export async function runCheck(root: HTMLElement, check: Check, ctx: CheckCtx): Promise<CheckResult> {
  for (const step of check.steps) {
    let fail: string | null;
    try {
      fail = await runStep(root, step, ctx);
    } catch (e) {
      fail = (e as Error)?.message ?? String(e);
    }
    const crash = ctx.error();
    if (crash) return { name: check.name, pass: false, detail: `The app crashed: ${crash}` };
    if (fail) return { name: check.name, pass: false, detail: fail };
  }
  return { name: check.name, pass: true };
}
