/**
 * Reads the student's code as a syntax tree (Babel) so checks can ask structural questions:
 * "is useState imported?", "does ProfileCard use its name prop?", "is FlatList given renderItem?".
 * Also finds JSX components that are used but never imported/declared (shown as editor errors).
 */
import { parse } from '@babel/parser';

type Node = { type: string; start?: number | null; end?: number | null; loc?: { start: { line: number; column: number } } | null; [key: string]: any };

export type Parsed = { code: string; ast: Node | null; error?: { message: string; line: number; column: number } };

export function parseCode(code: string): Parsed {
  try {
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true }) as unknown as Node;
    return { code, ast };
  } catch (error) {
    const e = error as Error & { loc?: { line: number; column: number } };
    return { code, ast: null, error: { message: e.message.replace(/\s*\(\d+:\d+\)$/, ''), line: e.loc?.line ?? 1, column: (e.loc?.column ?? 0) + 1 } };
  }
}

/** Depth-first walk over every node (parent passed along). */
export function walk(node: unknown, visit: (node: Node, parent: Node | null) => void, parent: Node | null = null) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit, parent);
    return;
  }
  const n = node as Node;
  if (typeof n.type !== 'string') return;
  visit(n, parent);
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue;
    walk(n[key], visit, n);
  }
}

export const lineOf = (node: Node) => node.loc?.start.line ?? 1;
export const source = (p: Parsed, node: Node | null | undefined) => (node && p.code.slice(node.start ?? 0, node.end ?? 0)) || '';

function jsxName(name: Node): string {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return `${jsxName(name.object)}.${name.property.name}`;
  if (name.type === 'JSXNamespacedName') return `${name.namespace.name}:${name.name.name}`;
  return '';
}

export type JsxAttr = { name: string; kind: 'string' | 'expression' | 'true'; value?: string; code: string; node: Node };
export type JsxElement = { name: string; attrs: Record<string, JsxAttr>; spread: boolean; line: number; node: Node; text: string; childElements: string[] };

/** Every JSX element in the file with its props (attrs) and the names of its direct child elements. */
export function jsxElements(p: Parsed): JsxElement[] {
  const out: JsxElement[] = [];
  if (!p.ast) return out;
  walk(p.ast, (node) => {
    if (node.type !== 'JSXElement') return;
    const open = node.openingElement;
    const attrs: Record<string, JsxAttr> = {};
    let spread = false;
    for (const a of open.attributes) {
      if (a.type === 'JSXSpreadAttribute') {
        spread = true;
        continue;
      }
      const name = a.name.type === 'JSXIdentifier' ? a.name.name : jsxName(a.name);
      const v = a.value;
      if (!v) attrs[name] = { name, kind: 'true', code: '', node: a };
      else if (v.type === 'StringLiteral') attrs[name] = { name, kind: 'string', value: v.value, code: source(p, v), node: a };
      else if (v.type === 'JSXExpressionContainer') {
        const expr = v.expression;
        const literal = expr?.type === 'StringLiteral' ? expr.value : expr?.type === 'TemplateLiteral' && expr.expressions.length === 0 ? expr.quasis[0].value.cooked : undefined;
        attrs[name] = { name, kind: 'expression', value: literal, code: source(p, expr), node: a };
      }
    }
    const childElements = (node.children as Node[]).filter((c) => c.type === 'JSXElement').map((c) => jsxName(c.openingElement.name));
    const text = (node.children as Node[])
      .filter((c) => c.type === 'JSXText')
      .map((c) => c.value)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    out.push({ name: jsxName(open.name), attrs, spread, line: lineOf(node), node, text, childElements });
  });
  return out;
}

/** import { a, b as c } from 'x'  →  Map { 'x' => Set{'a','b'} } (imported names, not local aliases) */
export function imports(p: Parsed): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!p.ast) return map;
  for (const stmt of p.ast.program.body as Node[]) {
    if (stmt.type !== 'ImportDeclaration') continue;
    const set = map.get(stmt.source.value) ?? new Set<string>();
    for (const s of stmt.specifiers) {
      if (s.type === 'ImportSpecifier') set.add(s.imported.name ?? s.imported.value);
      else if (s.type === 'ImportDefaultSpecifier') set.add('default');
      else if (s.type === 'ImportNamespaceSpecifier') set.add('*');
    }
    map.set(stmt.source.value, set);
  }
  return map;
}

/** Names that exist at the top level of the file: imports (local names), functions, classes, variables. */
export function topLevelNames(p: Parsed): Set<string> {
  const names = new Set<string>();
  if (!p.ast) return names;
  const addPattern = (pat: Node | null) => {
    if (!pat) return;
    if (pat.type === 'Identifier') names.add(pat.name);
    else if (pat.type === 'ObjectPattern') pat.properties.forEach((pr: Node) => addPattern(pr.type === 'RestElement' ? pr.argument : pr.value));
    else if (pat.type === 'ArrayPattern') pat.elements.forEach((el: Node | null) => addPattern(el));
    else if (pat.type === 'AssignmentPattern') addPattern(pat.left);
    else if (pat.type === 'RestElement') addPattern(pat.argument);
  };
  for (let stmt of p.ast.program.body as Node[]) {
    if ((stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration') && stmt.declaration) stmt = stmt.declaration;
    if (stmt.type === 'ImportDeclaration') stmt.specifiers.forEach((s: Node) => names.add(s.local.name));
    else if ((stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') && stmt.id) names.add(stmt.id.name);
    else if (stmt.type === 'VariableDeclaration') stmt.declarations.forEach((d: Node) => addPattern(d.id));
  }
  return names;
}

export type FunctionInfo = {
  name: string;
  line: number;
  node: Node;
  /** prop names read via destructuring ({ name, role }) or props.name */
  props: Set<string>;
  /** 'destructured' | 'object' (props) | 'none' */
  paramStyle: 'destructured' | 'object' | 'none';
  exportedDefault: boolean;
  returnsJsx: boolean;
};

/** Function components: function declarations and `const X = (...) => …` with a capitalised name. */
export function components(p: Parsed): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  if (!p.ast) return out;
  const consider = (name: string, fn: Node, exportedDefault: boolean, line: number) => {
    if (!/^[A-Z]/.test(name)) return;
    const param = fn.params?.[0] as Node | undefined;
    const props = new Set<string>();
    let paramStyle: FunctionInfo['paramStyle'] = 'none';
    if (param?.type === 'ObjectPattern' || (param?.type === 'AssignmentPattern' && param.left.type === 'ObjectPattern')) {
      paramStyle = 'destructured';
      const pattern = param.type === 'AssignmentPattern' ? param.left : param;
      for (const pr of pattern.properties) if (pr.type === 'ObjectProperty') props.add(pr.key.name ?? pr.key.value);
    } else if (param?.type === 'Identifier') {
      paramStyle = 'object';
      const objName = param.name;
      walk(fn.body, (n) => {
        if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === objName && n.property.type === 'Identifier') props.add(n.property.name);
      });
    }
    let returnsJsx = false;
    walk(fn.body, (n) => {
      if (n.type === 'JSXElement' || n.type === 'JSXFragment') returnsJsx = true;
    });
    out.push({ name, line, node: fn, props, paramStyle, exportedDefault, returnsJsx });
  };
  for (const stmt of p.ast.program.body as Node[]) {
    const isDefault = stmt.type === 'ExportDefaultDeclaration';
    const decl = stmt.type === 'ExportNamedDeclaration' || isDefault ? stmt.declaration : stmt;
    if (!decl) continue;
    if (decl.type === 'FunctionDeclaration' && decl.id) consider(decl.id.name, decl, isDefault, lineOf(decl));
    if (decl.type === 'VariableDeclaration') {
      for (const d of decl.declarations) {
        if (d.id.type === 'Identifier' && d.init && /ArrowFunctionExpression|FunctionExpression/.test(d.init.type)) consider(d.id.name, d.init, false, lineOf(d));
      }
    }
  }
  // `export default Card;` marks an earlier declaration as the default export
  for (const stmt of p.ast.program.body as Node[]) {
    if (stmt.type === 'ExportDefaultDeclaration' && stmt.declaration?.type === 'Identifier') {
      const hit = out.find((f) => f.name === stmt.declaration.name);
      if (hit) hit.exportedDefault = true;
    }
  }
  return out;
}

export type StateHook = { state: string; setter: string; initial: string; line: number };

/** const [count, setCount] = useState(0) */
export function stateHooks(p: Parsed): StateHook[] {
  const out: StateHook[] = [];
  walk(p.ast, (n) => {
    if (n.type !== 'VariableDeclarator' || n.id.type !== 'ArrayPattern' || n.init?.type !== 'CallExpression') return;
    const callee = n.init.callee;
    const name = callee.type === 'Identifier' ? callee.name : callee.type === 'MemberExpression' ? callee.property.name : '';
    if (name !== 'useState') return;
    const [s, set] = n.id.elements as (Node | null)[];
    out.push({ state: s?.name ?? '', setter: set?.name ?? '', initial: source(p, n.init.arguments[0]), line: lineOf(n) });
  });
  return out;
}

export type CallInfo = { callee: string; args: Node[]; line: number; node: Node; code: string };

/** Every call whose callee name matches (e.g. 'useEffect', 'setCount', /^set[A-Z]/). */
export function calls(p: Parsed, match?: string | RegExp): CallInfo[] {
  const out: CallInfo[] = [];
  walk(p.ast, (n) => {
    if (n.type !== 'CallExpression') return;
    const c = n.callee;
    const callee = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && c.property.type === 'Identifier' ? `${c.object.type === 'Identifier' ? c.object.name + '.' : ''}${c.property.name}` : '';
    if (match === undefined || (typeof match === 'string' ? callee === match || callee.endsWith('.' + match) : match.test(callee))) {
      out.push({ callee, args: n.arguments, line: lineOf(n), node: n, code: source(p, n) });
    }
  });
  return out;
}

/** True if `node` (or anything inside it) calls `name` / matches. */
export function containsCall(p: Parsed, node: Node | null | undefined, match: string | RegExp): boolean {
  if (!node) return false;
  return calls({ ...p, ast: node }, match).length > 0;
}

/** True if an identifier with this name is used anywhere inside node. */
export function usesIdentifier(node: Node | null | undefined, name: string): boolean {
  let found = false;
  walk(node, (n) => {
    if (n.type === 'Identifier' && n.name === name) found = true;
  });
  return found;
}

const JSX_GLOBALS = new Set(['React', 'Fragment']);

/** JSX components used but never imported or declared in the file: [{ name, line }] */
export function undefinedComponents(p: Parsed): { name: string; line: number }[] {
  const names = topLevelNames(p);
  const seen = new Set<string>();
  const out: { name: string; line: number }[] = [];
  for (const el of jsxElements(p)) {
    const root = el.name.split('.')[0];
    if (!/^[A-Z]/.test(root) || names.has(root) || JSX_GLOBALS.has(root) || seen.has(root)) continue;
    seen.add(root);
    out.push({ name: root, line: el.line });
  }
  return out;
}

/** Hooks called but not imported from 'react': [{ name, line }] */
export function unimportedHooks(p: Parsed): { name: string; line: number }[] {
  const names = topLevelNames(p);
  const seen = new Set<string>();
  return calls(p, /^use[A-Z]\w*$/)
    .filter((c) => !names.has(c.callee) && !seen.has(c.callee) && seen.add(c.callee))
    .map((c) => ({ name: c.callee, line: c.line }));
}
