/**
 * Reads and drives the rendered app through the DOM. Used inside the preview iframe and,
 * with happy-dom, in Node tests — so exercise checks behave the same in both places.
 */
import type { Found, Query } from './protocol.ts';

const PRESSABLE_RN = ['Pressable', 'Button', 'TouchableOpacity', 'TouchableHighlight'];

export const normalise = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Visible text of a node: text pieces joined as written, a space between separate elements. */
export function textOf(node: Node): string {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) out += child.nodeValue ?? '';
    else if (child.nodeType === 1) {
      const tag = (child as Element).tagName;
      if (tag !== 'SCRIPT' && tag !== 'STYLE') out += ` ${textOf(child)} `;
    }
  });
  return normalise(out);
}

function matches(value: string, want?: string | RegExp) {
  if (want === undefined) return true;
  return typeof want === 'string' ? value.toLowerCase().includes(want.toLowerCase()) : want.test(value);
}

function parseStyle(el: Element): Record<string, unknown> {
  try {
    return JSON.parse(el.getAttribute('data-rn-style') ?? '{}');
  } catch {
    return {};
  }
}

/** For lists: how many rows are rendered (FlatList → its cells; ScrollView → direct children). */
function itemsOf(el: Element): number | undefined {
  const rn = el.getAttribute('data-rn');
  if (rn !== 'FlatList' && rn !== 'ScrollView' && rn !== 'SectionList') return undefined;
  const content = el.firstElementChild;
  return content ? content.children.length : 0;
}

function describe(el: Element): Found {
  const input = el as HTMLInputElement;
  const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  return {
    rn: el.getAttribute('data-rn'),
    tag: el.tagName.toLowerCase(),
    text: textOf(el),
    ...(isField ? { value: input.value, placeholder: input.getAttribute('placeholder') ?? undefined } : null),
    testID: el.getAttribute('data-testid') ?? undefined,
    style: parseStyle(el),
    className: el.getAttribute('data-rn-class') ?? undefined,
    items: itemsOf(el),
  };
}

export function createDomDriver(getRoot: () => Element, settle: () => Promise<void> = () => new Promise((r) => setTimeout(r, 30))) {
  function candidates(q: Query = {}): Element[] {
    const root = getRoot();
    let list: Element[];
    if (q.testID) list = [...root.querySelectorAll(`[data-testid="${q.testID}"]`)];
    else if (q.rn) list = [...root.querySelectorAll(`[data-rn="${q.rn}"]`)];
    else if (q.tag) list = [...root.querySelectorAll(q.tag)];
    else list = [...root.querySelectorAll('*')];
    if (q.text !== undefined) list = list.filter((el) => matches(textOf(el), q.text));
    if (q.placeholder !== undefined) list = list.filter((el) => matches(el.getAttribute('placeholder') ?? '', q.placeholder));
    return list;
  }

  /** Keep only the innermost matches (a Pressable inside a View that also matches the text wins). */
  function innermost(list: Element[]) {
    return list.filter((el) => !list.some((other) => other !== el && el.contains(other)));
  }

  function pick(list: Element[], index = 0) {
    return list[index] ?? null;
  }

  function pressable(q: Query = {}) {
    const root = getRoot();
    let list = q.rn || q.tag || q.testID
      ? candidates({ rn: q.rn, tag: q.tag, testID: q.testID })
      : [...root.querySelectorAll(PRESSABLE_RN.map((n) => `[data-rn="${n}"]`).concat('button', '[role="button"]').join(','))];
    if (q.text !== undefined) list = list.filter((el) => matches(textOf(el) || (el.getAttribute('aria-label') ?? ''), q.text));
    return pick(innermost(list), q.index);
  }

  function field(q: Query = {}) {
    const root = getRoot();
    let list = q.testID ? candidates({ testID: q.testID }) : [...root.querySelectorAll('input, textarea')];
    if (q.placeholder !== undefined) list = list.filter((el) => matches(el.getAttribute('placeholder') ?? '', q.placeholder));
    return pick(list, q.index) as HTMLInputElement | HTMLTextAreaElement | null;
  }

  return {
    async text() {
      return textOf(getRoot());
    },
    async find(q: Query = {}) {
      const list = candidates(q);
      const chosen = q.text !== undefined && !q.rn && !q.tag && !q.testID ? innermost(list) : list;
      return (q.index !== undefined ? chosen.slice(q.index, q.index + 1) : chosen).map(describe);
    },
    async count(q: Query = {}) {
      return candidates(q).length;
    },
    async press(q: Query = {}) {
      const el = pressable(q) as HTMLElement | null;
      if (!el) return false;
      el.click();
      await settle();
      return true;
    },
    async type(q: Query, value: string) {
      const el = field(q);
      if (!el) return false;
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      return true;
    },
    async wait(ms: number) {
      await new Promise((r) => setTimeout(r, ms));
    },
  };
}
