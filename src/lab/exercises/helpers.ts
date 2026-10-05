/** Small, reusable questions that exercise checks ask about student code. */
import { components, jsxElements, walk, type JsxElement, type Parsed } from '../engine/analyze.ts';

export { components, jsxElements, stateHooks, calls, containsCall, usesIdentifier, walk, source, imports } from '../engine/analyze.ts';

/** JSX elements with this tag name, e.g. el(p, 'Pressable') */
export const el = (p: Parsed, name: string): JsxElement[] => jsxElements(p).filter((e) => e.name === name);

/** A function component by name */
export const comp = (p: Parsed, name: string) => components(p).find((c) => c.name === name);

/** True if inside `node`'s JSX the identifier (or `something.name`) is shown, e.g. {name} or {props.name} */
export function jsxShows(node: unknown, name: string): boolean {
  let found = false;
  walk(node, (n) => {
    if (found || n.type !== 'JSXExpressionContainer') return;
    walk(n.expression, (m) => {
      if (m.type === 'Identifier' && m.name === name) found = true;
      if (m.type === 'MemberExpression' && m.property?.type === 'Identifier' && m.property.name === name) found = true;
    });
  });
  return found;
}

/** First non-empty JSX text inside a node, e.g. "Hello, React!" */
export function firstJsxText(node: unknown): string {
  let text = '';
  walk(node, (n) => {
    if (!text && n.type === 'JSXText' && n.value.trim()) text = n.value.replace(/\s+/g, ' ').trim();
  });
  return text;
}

/** Plain text written directly inside View-like elements: <View>Hello</View> (crashes in React Native). */
export function rawTextInViews(p: Parsed): { parent: string; text: string; line: number }[] {
  const VIEWISH = new Set(['View', 'Pressable', 'ScrollView', 'SafeAreaView', 'TouchableOpacity', 'KeyboardAvoidingView']);
  const out: { parent: string; text: string; line: number }[] = [];
  for (const e of jsxElements(p)) {
    if (!VIEWISH.has(e.name)) continue;
    for (const child of e.node.children) {
      if (child.type === 'JSXText' && child.value.trim()) out.push({ parent: e.name, text: child.value.trim(), line: child.loc?.start.line ?? e.line });
    }
  }
  return out;
}

/** Lowercase (HTML) tags such as <div>, <button> — they don't exist in React Native. */
export const htmlTags = (p: Parsed) => jsxElements(p).filter((e) => /^[a-z]/.test(e.name));

/** fontWeight as a number ('bold' → 700) */
export const weight = (w: unknown) => (w === 'bold' ? 700 : w === 'normal' ? 400 : Number(w) || 0);

/** Every file's parsed tree that defines a component by name (for multi-file exercises) */
export function findComponent(all: Parsed[], name: string) {
  for (const p of all) {
    const f = comp(p, name);
    if (f) return { p, f };
  }
  return null;
}

/** Count how many times a phrase appears in a text */
export const occurrences = (text: string, phrase: string) => (phrase ? text.split(phrase).length - 1 : 0);
