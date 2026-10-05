# Lab 02 — React & React Native Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Lab 02 to the course site: React/React Native concepts, editable live demos, 11 auto-checked mini exercises, a live 4-page Recipes walkthrough, and a 4-page Movies app brief. It uses the same `<Part>`/`<Task>` style and motion as Lab 01.

**Architecture:**
- **Runner.** A sandboxed iframe runs a separately bundled runtime: development React 19, react-native-web, Sucrase, a tiny CommonJS module system, an `expo-router` shim and a DOM check engine. esbuild builds it from an Astro integration into `public/runner/runtime.js`.
- **Page side.** On the lab page, `<Playground>` and `<AppWalkthrough>` server-render the code and the phone frame. A lazy client controller adds a CodeMirror editor and talks to the iframe with `postMessage`.
- **Content.** Exercises are plain TS objects in `src/playgrounds/lab-02/`. The lab itself is `src/content/labs/lab-02.mdx`.

**Tech Stack:** Astro 7 + MDX, React 19.3 (development build inside the runner only), react-native-web 0.21, Sucrase 3.35, CodeMirror 6, esbuild 0.28, `node --test` with native TS type stripping, Playwright-core with system Chrome (scratchpad only, for end-to-end checks).

## Global Constraints

- All work on branch `lab-02`. Shared files touched only where listed: `src/pages/labs/[id].astro`, `src/components/Device.astro`, `astro.config.mjs`, `package.json`, `.gitignore`, `README.md`.
- Motion: animate only `transform`/`opacity`; reveal through `data-reveal` → `.in`, stagger through `.stg` + `--i`; everything respects `prefers-reduced-motion`.
- Colours only through the existing tokens in `src/styles/global.css` (dark and light). The editor's syntax colours are new local vars defined for both themes.
- Student code never runs on the site's origin. The iframe uses `sandbox="allow-scripts"` only.
- Nothing heavy on page load. The editor chunk loads when a playground nears the viewport. The runner loads on Run, or when a demo or walkthrough scrolls into view.
- Node unit tests import `.ts` directly (Node 24 type stripping). Use only erasable TS syntax (no enums, no parameter properties), use `import type` for types, and include the `.ts` extension in relative imports under `src/runner/`.
- Code shown to students must also work unchanged in a real Expo project (`expo-router` tabs template).

---

## File map

| File | Responsibility |
|---|---|
| `src/runner/protocol.ts` | Message and check types shared by the page and the iframe |
| `src/runner/modules.ts` | Sucrase compile, path resolution, per-run CommonJS module system |
| `src/runner/routes.ts` | expo-router file-name → route table, matching, href building |
| `src/runner/router-shim.tsx` | React implementation of `Stack`, `Tabs`, `Slot`, `Link`, `router`, hooks |
| `src/runner/checks.ts` | DOM check engine (press, type, expect…) |
| `src/runner/runtime.tsx` | iframe entry: console capture, error screen, mount, message handling |
| `src/runner/env.d.ts` | `declare module 'react-native-web'` |
| `src/integrations/runner.mjs` | esbuild build (and watch in dev) of the runtime |
| `public/runner/index.html` | The iframe document |
| `src/lib/playgrounds.ts` | `Playground` / `Walkthrough` types + lookup by id |
| `src/scripts/playground/editor.ts` | CodeMirror factory themed with site tokens |
| `src/scripts/playground/controller.ts` | Page-side behaviour for playgrounds and walkthroughs |
| `src/components/lab/Playground.astro` | Exercise and demo UI |
| `src/components/lab/AppWalkthrough.astro` | File tree + code + live phone |
| `src/components/lab/MockScreen.astro` | Static phone mockups of Movies screens |
| `src/playgrounds/lab-02/*.ts` | Exercises (e01…e11), demos, and `recipes` |
| `src/content/labs/lab-02.mdx` | The lab |
| `tests/runner.test.ts` | Unit tests for modules, routes and playground definitions |

---

### Task 1: Runner core: protocol, module system, routes (TDD)

**Files:**
- Create: `src/runner/protocol.ts`, `src/runner/modules.ts`, `src/runner/routes.ts`, `tests/runner.test.ts`
- Modify: `package.json` (test script)

**Interfaces:**
- Produces:
  - `compile(code, filePath): string`
  - `resolve(from, spec, files): string | null`
  - `createModuleSystem(files, builtins): { require(spec, from?) }`
  - `buildRoutes(fileNames): Route[]`
  - `matchRoute(routes, href): Match | null`
  - `childName(route, level): string`
  - `hrefOf(route): string`
  - `buildHref(href): string`
  - Types: `Files`, `Step`, `Check`, `CheckResult`, `ToRunner`, `FromRunner`, `Route`, `Match`

- [ ] **Step 1: Write `src/runner/protocol.ts`**

```ts
/** Messages between a playground on the lab page (parent) and the sandboxed runner iframe. */
export type Files = Record<string, string>;

/** One action or assertion a check performs on the running app, like a student would. */
export type Step =
  | { press: string } // tap the element showing this text (or with this testID)
  | { type: string; into: string } // type into the input with this placeholder (or testID)
  | { expectText: string; exact?: boolean } // exact: some element's whole text equals it
  | { expectNoText: string; exact?: boolean }
  | { expectFocused: string } // input (placeholder or testID) has keyboard focus
  | { expectStyle: { text: string; prop: string; includes: string } } // computed CSS, e.g. text-decoration-line
  | { expectCode: string; flags?: string; message: string } // regex over the student's source
  | { wait: number };
export type Check = { name: string; steps: Step[] };
export type CheckResult = { name: string; pass: boolean; detail?: string };

export type ToRunner =
  | { type: 'run'; files: Files }
  | { type: 'check'; files: Files; checks: Check[] }
  | { type: 'navigate'; href: string };

export type FromRunner =
  | { type: 'ready' }
  | { type: 'rendered' }
  | { type: 'console'; level: 'log' | 'info' | 'warn' | 'error'; text: string }
  | { type: 'error'; message: string }
  | { type: 'route'; href: string }
  | { type: 'check-result'; results: CheckResult[] };
```

- [ ] **Step 2: Write the failing tests `tests/runner.test.ts`**

```ts
// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, resolve, createModuleSystem } from '../src/runner/modules.ts';
import { buildRoutes, matchRoute, childName, hrefOf, buildHref } from '../src/runner/routes.ts';

/* ---------------- modules ---------------- */

test('compile turns TSX + imports into CommonJS with the automatic JSX runtime', () => {
  const out = compile(`import { View } from 'react-native';\nconst n: number = 1;\nexport default () => <View />;`, 'App.tsx');
  assert.match(out, /require\('react-native'\)/);
  assert.match(out, /require\('react\/jsx-runtime'\)/);
  assert.doesNotMatch(out, /: number/);
});

test('resolve finds relative, parent and @/ imports with or without extension', () => {
  const files = { 'app/index.tsx': '', 'components/Card.tsx': '', 'data/list.ts': '', 'context/index.ts': '' };
  assert.equal(resolve('app/index.tsx', '../components/Card', files), 'components/Card.tsx');
  assert.equal(resolve('app/index.tsx', '@/data/list', files), 'data/list.ts');
  assert.equal(resolve('components/Card.tsx', '../context', files), 'context/index.ts');
  assert.equal(resolve('App.tsx', './missing', files), null);
  assert.equal(resolve('App.tsx', 'react', files), null);
});

test('module system runs files, shares a cache and injects builtins', () => {
  const files = {
    'App.tsx': `import { greet } from './util';\nimport { n } from './util';\nexport default greet() + n;`,
    'util.ts': `export let n = 0; n++;\nexport const greet = () => 'hi ' + (globalThis as any).fake.name;`,
  };
  (globalThis as any).fake = { name: 'RN' };
  const sys = createModuleSystem(files, {});
  assert.equal(sys.require('App.tsx').default, 'hi RN1');
});

test('module system gives friendly errors', () => {
  const sys = createModuleSystem({ 'App.tsx': `import x from 'lodash';` }, {});
  assert.throws(() => sys.require('App.tsx'), /lodash.*isn't available/);
  const bad = createModuleSystem({ 'App.tsx': `const = 1;` }, {});
  assert.throws(() => bad.require('App.tsx'), /App\.tsx/);
  const missing = createModuleSystem({ 'App.tsx': `import x from './nope';` }, {});
  assert.throws(() => missing.require('App.tsx'), /Can't find file "\.\/nope"/);
});

/* ---------------- routes ---------------- */

const APP = ['app/_layout.tsx', 'app/(tabs)/_layout.tsx', 'app/(tabs)/index.tsx', 'app/(tabs)/favorites.tsx', 'app/(tabs)/add.tsx', 'app/recipe/[id].tsx', 'components/RecipeCard.tsx'];

test('buildRoutes maps files to URL segments, names and layout chains', () => {
  const routes = buildRoutes(APP);
  const byFile = Object.fromEntries(routes.map((r) => [r.file, r]));
  assert.equal(routes.length, 4);
  assert.deepEqual(byFile['app/(tabs)/index.tsx'].segments, []);
  assert.deepEqual(byFile['app/(tabs)/favorites.tsx'].segments, ['favorites']);
  assert.deepEqual(byFile['app/recipe/[id].tsx'].segments, ['recipe', '[id]']);
  assert.deepEqual(byFile['app/(tabs)/add.tsx'].layouts, ['app/_layout.tsx', 'app/(tabs)/_layout.tsx']);
  assert.deepEqual(byFile['app/recipe/[id].tsx'].layouts, ['app/_layout.tsx']);
  assert.equal(byFile['app/(tabs)/favorites.tsx'].name, 'favorites');
  assert.equal(byFile['app/recipe/[id].tsx'].name, 'recipe/[id]');
});

test('matchRoute matches static before dynamic and reads params + query', () => {
  const routes = buildRoutes(APP);
  assert.equal(matchRoute(routes, '/')?.route.file, 'app/(tabs)/index.tsx');
  const m = matchRoute(routes, '/recipe/3?from=home');
  assert.equal(m?.route.file, 'app/recipe/[id].tsx');
  assert.deepEqual(m?.params, { id: '3', from: 'home' });
  assert.equal(matchRoute(routes, '/nope'), null);
});

test('childName names what each navigator level is showing', () => {
  const routes = buildRoutes(APP);
  const fav = matchRoute(routes, '/favorites')!.route;
  assert.equal(childName(fav, 0), '(tabs)');
  assert.equal(childName(fav, 1), 'favorites');
  assert.equal(childName(matchRoute(routes, '/recipe/1')!.route, 0), 'recipe/[id]');
});

test('hrefOf and buildHref', () => {
  const routes = buildRoutes(APP);
  assert.equal(hrefOf(matchRoute(routes, '/favorites')!.route), '/favorites');
  assert.equal(buildHref('/x'), '/x');
  assert.equal(buildHref({ pathname: '/recipe/[id]', params: { id: 4, tab: 'a b' } }), '/recipe/4?tab=a+b');
});
```

- [ ] **Step 3: Change the test script and run it (expect FAIL: modules not found)**

`package.json`: `"test": "node --test tests/attendance.test.ts tests/runner.test.ts"`

Run: `npm test` → FAIL, `Cannot find module '…/src/runner/modules.ts'`.

- [ ] **Step 4: Write `src/runner/modules.ts`**

```ts
/**
 * A tiny CommonJS module system for student code: each file is compiled with Sucrase
 * (TypeScript + JSX → plain JS) and evaluated on demand. A fresh system per run.
 */
import { transform } from 'sucrase';
import type { Files } from './protocol.ts';

const EXT = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.js'];

export function compile(code: string, filePath: string): string {
  return transform(code, { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'automatic', production: true, filePath }).code;
}

function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** './x', '../x' and '@/x' (project root, like the Expo template) → a file in `files`. */
export function resolve(from: string, spec: string, files: Files): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = normalize(spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) base = normalize([...from.split('/').slice(0, -1), spec].join('/'));
  else return null;
  for (const ext of EXT) if (files[base + ext] != null) return base + ext;
  return null;
}

export type ModuleSystem = { require: (spec: string, from?: string) => any };

export function createModuleSystem(files: Files, builtins: Record<string, unknown>): ModuleSystem {
  const cache = new Map<string, { exports: any }>();
  const load = (path: string) => {
    const hit = cache.get(path);
    if (hit) return hit.exports;
    let code: string;
    try {
      code = compile(files[path], path);
    } catch (e) {
      throw new Error(`${path}: ${(e as Error).message}`);
    }
    const module = { exports: {} as any };
    cache.set(path, module);
    const fn = new Function('require', 'module', 'exports', `${code}\n//# sourceURL=${path}`);
    fn((spec: string) => requireFrom(spec, path), module, module.exports);
    return module.exports;
  };
  const requireFrom = (spec: string, from: string): any => {
    if (Object.prototype.hasOwnProperty.call(builtins, spec)) return builtins[spec];
    if (files[spec] != null) return load(spec);
    const path = resolve(from, spec, files);
    if (path) return load(path);
    if (/^(\.|@\/)/.test(spec)) throw new Error(`Can't find file "${spec}" imported from "${from}".`);
    throw new Error(`The package "${spec}" isn't available in the browser runner. You can import: react, react-native, expo-router.`);
  };
  return { require: (spec, from = '') => requireFrom(spec, from) };
}
```

- [ ] **Step 5: Write `src/runner/routes.ts`**

```ts
/**
 * expo-router's file-based routing, reduced to what the labs use:
 * app/_layout.tsx, groups like (tabs), index routes and [param] segments.
 */
export type Route = { file: string; name: string; segments: string[]; layouts: string[] };
export type Match = { route: Route; params: Record<string, string> };
export type Href = string | { pathname: string; params?: Record<string, string | number> };

const CODE = /\.(tsx|ts|jsx|js)$/;
const strip = (f: string) => f.replace(CODE, '');
const dirOf = (f: string) => f.slice(0, f.lastIndexOf('/'));
const isGroup = (s: string) => /^\(.*\)$/.test(s);
const isDynamic = (s: string) => /^\[.+\]$/.test(s);

/** What a navigator at `level` of the route's layout chain is currently showing. */
export function childName(route: Route, level: number): string {
  const dir = dirOf(route.layouts[level]);
  const next = route.layouts[level + 1];
  return next ? dirOf(next).slice(dir.length + 1) : strip(route.file).slice(dir.length + 1);
}

export function buildRoutes(fileNames: string[]): Route[] {
  const layoutIn = new Map<string, string>();
  for (const f of fileNames) if (/^app\/(.*\/)?_layout\.(tsx|ts|jsx|js)$/.test(f)) layoutIn.set(dirOf(f), f);
  const routes: Route[] = [];
  for (const file of fileNames) {
    if (!file.startsWith('app/') || !CODE.test(file) || /(^|\/)_layout\.\w+$/.test(file)) continue;
    const parts = strip(file).split('/').slice(1);
    const layouts: string[] = [];
    let dir = 'app';
    if (layoutIn.has(dir)) layouts.push(layoutIn.get(dir)!);
    for (const p of parts.slice(0, -1)) {
      dir += `/${p}`;
      if (layoutIn.has(dir)) layouts.push(layoutIn.get(dir)!);
    }
    const segments = parts.filter((p) => !isGroup(p));
    if (segments[segments.length - 1] === 'index') segments.pop();
    const base = layouts.length ? dirOf(layouts[layouts.length - 1]) : 'app';
    routes.push({ file, name: strip(file).slice(base.length + 1), segments, layouts });
  }
  const dyn = (r: Route) => r.segments.filter(isDynamic).length;
  return routes.sort((a, b) => dyn(a) - dyn(b));
}

export function matchRoute(routes: Route[], href: string): Match | null {
  const [path, query = ''] = href.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  for (const route of routes) {
    if (route.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = route.segments.every((seg, i) => {
      if (isDynamic(seg)) return (params[seg.slice(1, -1)] = parts[i]), true;
      return seg === parts[i];
    });
    if (!ok) continue;
    new URLSearchParams(query).forEach((v, k) => { if (!(k in params)) params[k] = v; });
    return { route, params };
  }
  return null;
}

export const hrefOf = (route: Route) => `/${route.segments.join('/')}`;
export const isDynamicRoute = (route: Route) => route.segments.some(isDynamic);

export function buildHref(href: Href): string {
  if (typeof href === 'string') return href;
  const params: Record<string, string | number> = { ...(href.params ?? {}) };
  const path = href.pathname.replace(/\[(\w+)\]/g, (_, k: string) => {
    const v = params[k];
    delete params[k];
    return encodeURIComponent(String(v));
  });
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return q ? `${path}?${q}` : path;
}
```

- [ ] **Step 6: Run `npm test` → all PASS** (attendance tests still pass too).

- [ ] **Step 7: Commit** `git add src/runner tests/runner.test.ts package.json && git commit -m "Add runner core: module system and expo-router routes"`

---

### Task 2: Runtime bundle: router shim, check engine, iframe entry, build integration

**Files:**
- Create: `src/runner/router-shim.tsx`, `src/runner/checks.ts`, `src/runner/runtime.tsx`, `src/runner/env.d.ts`, `src/integrations/runner.mjs`, `public/runner/index.html`
- Modify: `astro.config.mjs` (add integration), `.gitignore` (`public/runner/runtime.js`), `package.json` (devDeps `@types/react`, `@types/react-dom`)

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  - **iframe URL** `/runner/index.html`.
  - **Message protocol** per `protocol.ts`:
    - `ready` is posted once on load.
    - `run` → mount, then `rendered`.
    - `check` → for each check: fresh mount, then the steps. Then a final fresh mount and `check-result`.
    - `navigate` → `goTo(href)` (static routes reset history; dynamic routes push).
    - `route` is posted on every route change.
  - **Shim exports:** `Stack`, `Stack.Screen`, `Tabs`, `Tabs.Screen`, `Slot`, `Link`, `router`, `useRouter`, `useLocalSearchParams`, `useGlobalSearchParams`, `usePathname`, `createRouterApp`, `goTo`.

- [ ] **Step 1: `src/runner/router-shim.tsx`**

```tsx
/**
 * Just enough of expo-router to run the lab apps in the browser:
 * Stack / Tabs layouts, Stack.Screen options, Link, router and route params.
 */
import React, { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useLayoutEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native-web';
import { buildHref, buildRoutes, childName, hrefOf, isDynamicRoute, matchRoute, type Href, type Match, type Route } from './routes.ts';

type Options = {
  title?: string;
  headerShown?: boolean;
  headerStyle?: object;
  headerTintColor?: string;
  tabBarIcon?: (p: { color: string; size: number; focused: boolean }) => ReactNode;
  tabBarActiveTintColor?: string;
  tabBarInactiveTintColor?: string;
};
type Nav = { href: string; history: string[]; push(h: Href): void; replace(h: Href): void; back(): void; goTo(h: string): void };
type Ctx = { nav: Nav; routes: Route[]; match: Match; chain: ComponentType[] };

const RouterCtx = createContext<Ctx | null>(null);
const LevelCtx = createContext(0);
const OptionsCtx = createContext<((o: Options) => void) | null>(null);

let active: Nav | null = null;
export const router = {
  push: (h: Href) => active?.push(h),
  navigate: (h: Href) => active?.push(h),
  replace: (h: Href) => active?.replace(h),
  back: () => active?.back(),
  canGoBack: () => (active?.history.length ?? 0) > 1,
};
export const goTo = (href: string) => active?.goTo(href);
export const useRouter = () => router;

function useRouterCtx() {
  const c = useContext(RouterCtx);
  if (!c) throw new Error('expo-router hooks only work in files inside the app/ folder.');
  return c;
}
export const useLocalSearchParams = () => useRouterCtx().match.params;
export const useGlobalSearchParams = useLocalSearchParams;
export const usePathname = () => useRouterCtx().nav.href.split('?')[0];

function Level({ depth }: { depth: number }) {
  const Comp = useRouterCtx().chain[depth];
  return Comp ? <LevelCtx.Provider value={depth}><Comp /></LevelCtx.Provider> : null;
}
export function Slot() {
  return <Level depth={useContext(LevelCtx) + 1} />;
}

/** In a layout: <Stack.Screen name="…" options={…} />. In a screen: <Stack.Screen options={…} />. */
function ScreenConfig({ options }: { name?: string; options?: Options }) {
  const set = useContext(OptionsCtx);
  const key = JSON.stringify(options ?? {});
  useLayoutEffect(() => {
    if (options) set?.(options);
  }, [set, key]);
  return null;
}

function configsFrom(children: ReactNode) {
  const map = new Map<string, Options>();
  Children.forEach(children, (c) => {
    if (isValidElement<{ name?: string; options?: Options }>(c) && c.props.name) map.set(c.props.name, c.props.options ?? {});
  });
  return map;
}

function useNavigator(children: ReactNode, screenOptions: Options = {}) {
  const ctx = useRouterCtx();
  const depth = useContext(LevelCtx);
  const name = childName(ctx.match.route, depth);
  const [own, setOwn] = useState<{ href: string; opts: Options }>({ href: '', opts: {} });
  const setOptions = useCallback((opts: Options) => setOwn({ href: ctx.nav.href, opts }), [ctx.nav.href]);
  const configs = configsFrom(children);
  const options: Options = { ...screenOptions, ...configs.get(name), ...(own.href === ctx.nav.href ? own.opts : {}) };
  return { ...ctx, depth, name, options, setOptions, configs };
}

function Header({ title, back, options }: { title: string; back: boolean; options: Options }) {
  const tint = options.headerTintColor ?? '#11181c';
  return (
    <View style={[s.header, options.headerStyle]}>
      {back && (
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Back">
          <Text style={[s.backText, { color: options.headerTintColor ?? '#2563eb' }]}>‹ Back</Text>
        </Pressable>
      )}
      <Text style={[s.title, { color: tint }]} numberOfLines={1}>{title}</Text>
    </View>
  );
}

type NavProps = { children?: ReactNode; screenOptions?: Options };

function StackNavigator({ children, screenOptions }: NavProps) {
  const { depth, name, options, setOptions, nav } = useNavigator(children, screenOptions);
  return (
    <View style={s.fill}>
      {options.headerShown !== false && <Header title={options.title ?? name} back={nav.history.length > 1} options={options} />}
      <OptionsCtx.Provider value={setOptions}>
        <View style={s.fill}><Level depth={depth + 1} /></View>
      </OptionsCtx.Provider>
    </View>
  );
}
export const Stack = Object.assign(StackNavigator, { Screen: ScreenConfig });

function TabsNavigator({ children, screenOptions }: NavProps) {
  const { depth, name, options, setOptions, configs, nav, match, routes } = useNavigator(children, screenOptions);
  const layout = match.route.layouts[depth];
  const order = [...configs.keys()];
  const rank = (n: string) => (order.indexOf(n) === -1 ? 999 : order.indexOf(n));
  const tabs = routes
    .filter((r) => r.layouts[depth] === layout && r.layouts.length === depth + 1 && !isDynamicRoute(r))
    .sort((a, b) => rank(a.name) - rank(b.name));
  const on = options.tabBarActiveTintColor ?? '#2563eb';
  const off = options.tabBarInactiveTintColor ?? '#8e8e93';
  return (
    <View style={s.fill}>
      {options.headerShown !== false && <Header title={options.title ?? name} back={false} options={options} />}
      <OptionsCtx.Provider value={setOptions}>
        <View style={s.fill}><Level depth={depth + 1} /></View>
      </OptionsCtx.Provider>
      <View style={s.tabbar} accessibilityRole="tablist">
        {tabs.map((t) => {
          const o = { ...screenOptions, ...configs.get(t.name) };
          const focused = t.name === name;
          const color = focused ? on : off;
          return (
            <Pressable key={t.file} style={s.tab} onPress={() => nav.replace(hrefOf(t))} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
              {o.tabBarIcon?.({ color, size: 20, focused })}
              <Text style={[s.tabLabel, { color }]}>{o.title ?? t.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
export const Tabs = Object.assign(TabsNavigator, { Screen: ScreenConfig });

type LinkProps = { href: Href; replace?: boolean; asChild?: boolean; children?: ReactNode; style?: any; [k: string]: any };
export function Link({ href, replace, asChild, children, style, ...rest }: LinkProps) {
  const go = () => (replace ? router.replace(href) : router.push(href));
  if (asChild && isValidElement(children)) return cloneElement(children as React.ReactElement<any>, { onPress: go });
  return <Text accessibilityRole="link" style={[{ color: '#2563eb' }, style]} onPress={go} {...rest}>{children}</Text>;
}

/** Builds the root component for a project that has an app/ folder. */
export function createRouterApp(fileNames: string[], load: (file: string) => any, onRoute: (href: string) => void) {
  const routes = buildRoutes(fileNames);
  return function RouterApp() {
    const [history, setHistory] = useState<string[]>(['/']);
    const href = history[history.length - 1];
    const nav = useMemo<Nav>(() => ({
      href,
      history,
      push: (h) => setHistory((hs) => [...hs, buildHref(h)]),
      replace: (h) => setHistory((hs) => [...hs.slice(0, -1), buildHref(h)]),
      back: () => setHistory((hs) => (hs.length > 1 ? hs.slice(0, -1) : hs)),
      goTo: (h) => setHistory((hs) => {
        if (hs[hs.length - 1] === h) return hs;
        const m = matchRoute(routes, h);
        return m && !isDynamicRoute(m.route) ? [h] : [...hs, h];
      }),
    }), [history]);
    active = nav;
    useLayoutEffect(() => onRoute(href), [href]);
    const match = matchRoute(routes, href);
    if (!match) return <View style={s.center}><Text style={s.title}>Unmatched route</Text><Text>{href}</Text></View>;
    const chain = [...match.route.layouts, match.route.file].map((f) => {
      const Comp = load(f).default;
      if (typeof Comp !== 'function') throw new Error(`${f} must "export default" a component.`);
      return Comp as ComponentType;
    });
    return <RouterCtx.Provider value={{ nav, routes, match, chain }}><Level depth={0} /></RouterCtx.Provider>;
  };
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff', paddingHorizontal: 56 },
  back: { position: 'absolute', left: 8, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 6 },
  backText: { fontSize: 15 },
  title: { fontSize: 16, fontWeight: '600' },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff', paddingTop: 6, paddingBottom: 10 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 11, fontWeight: '500' },
});
```

- [ ] **Step 2: `src/runner/checks.ts`**

```ts
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
```

- [ ] **Step 3: `src/runner/runtime.tsx`**

```tsx
/**
 * Runs inside the sandboxed iframe (public/runner/index.html).
 * Development React on purpose: students get readable errors and warnings (e.g. a missing `key`).
 */
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { createRoot, type Root } from 'react-dom/client';
import * as ReactNative from 'react-native-web';
import * as ExpoRouter from './router-shim.tsx';
import { createModuleSystem } from './modules.ts';
import { runCheck } from './checks.ts';
import type { Files, FromRunner, ToRunner, CheckResult } from './protocol.ts';

const post = (msg: FromRunner) => parent.postMessage(msg, '*');
const host = document.getElementById('root')!;
const redbox = document.getElementById('redbox')!;
const settle = (ms = 80) => new Promise<void>((r) => setTimeout(r, ms));

const builtins: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'react-native': ReactNative,
  'react-native-web': ReactNative,
  'expo-router': ExpoRouter,
  'expo-status-bar': { StatusBar: () => null },
};

/* ---------- console → page ---------- */
const show = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.message;
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
};
function format(args: unknown[]) {
  const rest = [...args];
  let first = rest.shift();
  if (typeof first === 'string') first = first.replace(/%[sdifoOc]/g, () => show(rest.shift()));
  return [first, ...rest].map(show).join(' ').slice(0, 800);
}
for (const level of ['log', 'info', 'warn', 'error'] as const) {
  const orig = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    orig(...args);
    const text = format(args);
    if (!/React DevTools/.test(text)) post({ type: 'console', level, text });
  };
}

/* ---------- red error screen, like React Native's ---------- */
let lastError: string | null = null;
function showError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  if (lastError === message) return;
  lastError = message;
  redbox.hidden = false;
  redbox.querySelector('pre')!.textContent = message;
  post({ type: 'error', message });
}
window.addEventListener('error', (e) => showError(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

/* ---------- mount ---------- */
let root: Root | null = null;
async function mount(files: Files) {
  root?.unmount();
  lastError = null;
  redbox.hidden = true;
  root = createRoot(host, { onUncaughtError: showError, onCaughtError: showError });
  try {
    const sys = createModuleSystem(files, builtins);
    const names = Object.keys(files);
    let App: React.ComponentType;
    if (names.some((f) => f.startsWith('app/'))) {
      App = ExpoRouter.createRouterApp(names, (f) => sys.require(f), (href) => post({ type: 'route', href }));
    } else {
      const entry = names.includes('App.tsx') ? 'App.tsx' : names[0];
      App = sys.require(entry).default;
      if (typeof App !== 'function') throw new Error(`${entry} must "export default" a component.`);
    }
    root.render(<ReactNative.View style={{ flex: 1 }}><App /></ReactNative.View>);
  } catch (e) {
    showError(e);
  }
  await settle(150);
  return host;
}

/* ---------- messages from the page ---------- */
window.addEventListener('message', async (e) => {
  if (e.source !== parent) return;
  const msg = e.data as ToRunner;
  if (msg.type === 'run') {
    await mount(msg.files);
    post({ type: 'rendered' });
  } else if (msg.type === 'navigate') {
    ExpoRouter.goTo(msg.href);
  } else if (msg.type === 'check') {
    const source = Object.values(msg.files).join('\n');
    const results: CheckResult[] = [];
    for (const check of msg.checks) {
      const el = await mount(msg.files);
      results.push(await runCheck(el, check, { source, settle: () => settle(), error: () => lastError }));
    }
    await mount(msg.files);
    post({ type: 'check-result', results });
  }
});
post({ type: 'ready' });
```

- [ ] **Step 4: `src/runner/env.d.ts`**: `declare module 'react-native-web';`

- [ ] **Step 5: `public/runner/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>App preview</title>
  <style>
    html, body { margin: 0; height: 100%; background: #fff; color: #11181c; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    #root { height: 100%; display: flex; flex-direction: column; }
    #redbox { position: fixed; inset: 0; z-index: 10; overflow: auto; padding: 16px; background: #c62828; color: #fff; font: 12.5px/1.55 ui-monospace, Consolas, monospace; }
    #redbox b { display: block; margin-bottom: 8px; font: 700 15px system-ui, sans-serif; }
    #redbox pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
    #redbox p { margin: 14px 0 0; opacity: 0.85; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="redbox" hidden role="alert"><b>Error</b><pre></pre><p>Fix the code, then press ▶ Run.</p></div>
  <script src="runtime.js"></script>
</body>
</html>
```

- [ ] **Step 6: `src/integrations/runner.mjs`** and register it

```js
/**
 * Builds the playground runtime (src/runner/runtime.tsx → public/runner/runtime.js) with esbuild.
 * Separate from Vite on purpose: it bundles the *development* build of React for readable errors.
 */
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';

const options = (root) => ({
  entryPoints: [fileURLToPath(new URL('src/runner/runtime.tsx', root))],
  outfile: fileURLToPath(new URL('public/runner/runtime.js', root)),
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'warning',
});

export default function runner() {
  let ctx;
  return {
    name: 'lab-runner',
    hooks: {
      'astro:config:setup': async ({ config, command, logger }) => {
        if (command !== 'dev' && command !== 'build') return;
        await ctx?.dispose();
        if (command === 'dev') {
          ctx = await esbuild.context(options(config.root));
          await ctx.rebuild();
          await ctx.watch();
        } else await esbuild.build(options(config.root));
        logger.info('playground runtime built → public/runner/runtime.js');
      },
      'astro:server:done': async () => { await ctx?.dispose(); },
    },
  };
}
```

`astro.config.mjs`: `import runner from './src/integrations/runner.mjs';` and `integrations: [mdx(), runner()]`. `.gitignore`: add `public/runner/runtime.js`.

- [ ] **Step 7: Verify** by restarting the dev server. The log shows "playground runtime built" and `curl -s localhost:4321/runner/index.html` returns the HTML. Then run the spike page from the scratchpad against `/runner/index.html`: post `run` with a counter `App.tsx`, then post `check` with `[{name:'+', steps:[{press:'+'},{expectText:'1',exact:true}]}]` → expect `pass: true`.

- [ ] **Step 8: Commit** `git commit -m "Add sandboxed playground runtime with expo-router shim and check engine"`

---

### Task 3: Editor + Playground component + page controller

**Files:**
- Create: `src/lib/playgrounds.ts`, `src/scripts/playground/editor.ts`, `src/scripts/playground/controller.ts`, `src/components/lab/Playground.astro`, `src/playgrounds/lab-02/e05-counter.ts` (first exercise, used to develop the UI)
- Modify:
  - `src/components/Device.astro`: an `interactive` prop omits `role="img"`
  - `src/pages/labs/[id].astro`: register `Playground`, `AppWalkthrough` and `MockScreen` in `components`; import the controller

**Interfaces:**
- `Playground = { title: string; goal?: string; hint?: string; files: Files; solution?: Files; checks?: Check[] }`
- `Walkthrough = Playground & { tree: { file: string; note: string; href?: string }[] }`
- `getPlayground(id): Playground & { checks: Check[] }`
- DOM contract (used by the controller):
  - root `[data-playground]` with `data-mode="exercise|demo"`
  - `script[data-pg-def]` holding JSON `{ id, files, checks }`
  - inside the root: `[data-pg-editor]`, `[data-pg-file]`, `[data-pg-screen]`, `[data-pg-run]`, `[data-pg-check]`, `[data-pg-reset]`, `[data-pg-hint]`, `[data-pg-hint-box]`, `[data-pg-sol]`, `[data-pg-solution]`, `[data-pg-console]`, `[data-pg-checks] > li[data-state]`
- Saved code: `localStorage['playground:<id>']` = JSON `Files`. Passing all checks ticks the enclosing `.task` `[data-task-check]` box and dispatches `change`.

- [ ] **Step 1: `src/lib/playgrounds.ts`**

```ts
/** Exercise / demo definitions live in src/playgrounds/<lab>/<id>.ts and are looked up by id. */
import type { Check, Files } from '@/runner/protocol';

export type Playground = { title: string; goal?: string; hint?: string; files: Files; solution?: Files; checks?: Check[] };
export type Walkthrough = Playground & { tree: { file: string; note: string; href?: string }[] };

const mods = import.meta.glob<{ default: Playground }>('/src/playgrounds/**/*.ts', { eager: true });

export function getPlayground<T extends Playground = Playground>(id: string): T & { checks: Check[] } {
  const hit = Object.entries(mods).find(([path]) => path.endsWith(`/${id}.ts`));
  if (!hit) throw new Error(`Playground "${id}" not found in src/playgrounds/`);
  const def = hit[1].default as T;
  return { ...def, checks: def.checks ?? [] };
}
```

- [ ] **Step 2: `src/scripts/playground/editor.ts`**

```ts
/** CodeMirror 6, themed with the site's tokens (works in dark and light). Loaded lazily. */
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';

const theme = EditorView.theme({
  '&': { color: 'var(--text)', backgroundColor: 'var(--code-bg)', fontSize: '13px', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7' },
  '.cm-content': { caretColor: 'var(--accent-text)', padding: '12px 0' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--text-3)', border: 'none', paddingLeft: '6px' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--accent) 5%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-2)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in oklab, var(--accent) 24%, transparent) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--accent-text)', borderLeftWidth: '2px' },
  '.cm-matchingBracket': { backgroundColor: 'var(--accent-soft)', outline: '1px solid var(--line-2)' },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword], color: 'var(--pg-kw)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--pg-str)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--pg-num)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--text-3)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--pg-fn)' },
  { tag: [t.typeName, t.className, t.tagName, t.standard(t.tagName)], color: 'var(--pg-tag)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--pg-attr)' },
]);

export type Editor = { view: EditorView; setDoc(doc: string): void };

export function createEditor(parent: HTMLElement, doc: string, opts: { label: string; onChange(doc: string): void; onRun(): void }): Editor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(), history(), indentOnInput(), bracketMatching(), closeBrackets(),
        javascript({ jsx: true, typescript: true }), syntaxHighlighting(highlight), theme, EditorState.tabSize.of(2),
        keymap.of([{ key: 'Mod-Enter', run: () => (opts.onRun(), true) }, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => { if (u.docChanged) opts.onChange(u.state.doc.toString()); }),
        EditorView.contentAttributes.of({ 'aria-label': opts.label }),
      ],
    }),
  });
  return { view, setDoc: (d) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: d } }) };
}
```

- [ ] **Step 3: `src/scripts/playground/controller.ts`**

```ts
/**
 * Page side of <Playground> and <AppWalkthrough>. Lazy: the editor loads when a playground
 * nears the viewport; the runner iframe loads on Run (exercises) or when visible (demos).
 */
import type { Check, CheckResult, Files, FromRunner, ToRunner } from '@/runner/protocol';
import type { Editor } from './editor';

type Def = { id: string; files: Files; checks: Check[] };
const RUNNER = '/runner/index.html';
const handlers = new Map<Window, (m: FromRunner) => void>();
window.addEventListener('message', (e) => {
  const h = e.source && handlers.get(e.source as Window);
  if (h) h(e.data as FromRunner);
});

const load = (id: string): Files | null => { try { return JSON.parse(localStorage.getItem(`playground:${id}`) || 'null'); } catch { return null; } };
const save = (id: string, files: Files | null) => {
  try { files ? localStorage.setItem(`playground:${id}`, JSON.stringify(files)) : localStorage.removeItem(`playground:${id}`); } catch {}
};
const nearView = (el: Element, cb: () => void, margin = '300px') => {
  if (!('IntersectionObserver' in window)) return cb();
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); cb(); } }, { rootMargin: margin });
  io.observe(el);
};

/** One sandboxed runner per playground. */
function createFrame(screen: HTMLElement, onMessage: (m: FromRunner) => void) {
  let frame: HTMLIFrameElement | null = null;
  let ready: Promise<void> | null = null;
  const ensure = () => {
    if (ready) return ready;
    frame = Object.assign(document.createElement('iframe'), { src: RUNNER, title: 'App preview', loading: 'eager' });
    frame.setAttribute('sandbox', 'allow-scripts');
    ready = new Promise<void>((res) => {
      screen.replaceChildren(frame!);
      handlers.set(frame!.contentWindow!, (m) => { if (m.type === 'ready') res(); onMessage(m); });
    });
    return ready;
  };
  return { ensure, send: async (m: ToRunner) => { await ensure(); frame!.contentWindow!.postMessage(m, '*'); } };
}

function setupPlayground(root: HTMLElement) {
  const def = JSON.parse(root.querySelector('script[data-pg-def]')!.textContent!) as Def;
  const exercise = root.dataset.mode === 'exercise';
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
  let files: Files = { ...def.files, ...(load(def.id) ?? {}) };
  let current = Object.keys(def.files)[0];
  let editor: Editor | null = null;
  const consoleEl = $('[data-pg-console]')!;
  const runBtn = $<HTMLButtonElement>('[data-pg-run]')!;
  const checkBtn = $<HTMLButtonElement>('[data-pg-check]');

  const log = (level: string, text: string) => {
    consoleEl.querySelector('.pg-empty')?.remove();
    const line = Object.assign(document.createElement('div'), { className: `pg-log ${level}`, textContent: text });
    consoleEl.append(line);
    while (consoleEl.children.length > 200) consoleEl.firstElementChild!.remove();
    consoleEl.scrollTop = consoleEl.scrollHeight;
  };
  const clearConsole = () => consoleEl.replaceChildren(Object.assign(document.createElement('span'), { className: 'pg-empty', textContent: 'console.log output appears here' }));

  const frame = createFrame($('[data-pg-screen]')!, (m) => {
    if (m.type === 'console') log(m.level, m.text);
    else if (m.type === 'error') log('error', `⛔ ${m.message}`);
    else if (m.type === 'check-result') showResults(m.results);
  });

  const run = () => {
    root.classList.remove('is-dirty');
    clearConsole();
    frame.send({ type: 'run', files });
  };

  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-pg-checks] > li'));
  function showResults(results: CheckResult[]) {
    results.forEach((r, i) => {
      const li = items[i];
      if (!li) return;
      li.dataset.state = r.pass ? 'pass' : 'fail';
      li.querySelector('[data-detail]')!.textContent = r.pass ? '' : r.detail ?? '';
    });
    root.classList.remove('is-checking');
    if (checkBtn) checkBtn.disabled = false;
    const sol = $<HTMLButtonElement>('[data-pg-sol]');
    if (sol) { sol.disabled = false; sol.title = ''; }
    const allPass = results.length > 0 && results.every((r) => r.pass);
    root.classList.toggle('is-passed', allPass);
    if (allPass) {
      const box = root.closest('.task')?.querySelector<HTMLInputElement>('[data-task-check]');
      if (box && !box.checked) { box.checked = true; box.dispatchEvent(new Event('change')); }
    }
  }
  const check = () => {
    if (!checkBtn) return;
    checkBtn.disabled = true;
    root.classList.add('is-checking');
    items.forEach((li) => { li.dataset.state = 'running'; li.querySelector('[data-detail]')!.textContent = ''; });
    clearConsole();
    frame.send({ type: 'check', files, checks: def.checks });
  };

  runBtn.addEventListener('click', run);
  checkBtn?.addEventListener('click', check);
  $('[data-pg-reset]')?.addEventListener('click', () => {
    files = { ...def.files };
    save(def.id, null);
    editor?.setDoc(files[current]);
    save(def.id, null);
    root.classList.remove('is-passed');
    items.forEach((li) => (li.dataset.state = 'idle'));
    run();
  });
  $('[data-pg-hint]')?.addEventListener('click', (e) => {
    const box = $('[data-pg-hint-box]')!;
    box.hidden = !box.hidden;
    (e.currentTarget as HTMLElement).setAttribute('aria-expanded', String(!box.hidden));
  });
  $('[data-pg-sol]')?.addEventListener('click', (e) => {
    const box = $('[data-pg-solution]')!;
    box.hidden = !box.hidden;
    (e.currentTarget as HTMLElement).setAttribute('aria-expanded', String(!box.hidden));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-pg-file]').forEach((tab) =>
    tab.addEventListener('click', () => {
      current = tab.dataset.pgFile!;
      root.querySelectorAll('[data-pg-file]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      editor?.setDoc(files[current]);
    }),
  );

  nearView(root, async () => {
    const { createEditor } = await import('./editor');
    const host = $('[data-pg-editor]')!;
    host.replaceChildren();
    editor = createEditor(host, files[current], {
      label: `${def.id} code editor`,
      onRun: run,
      onChange: (doc) => {
        if (files[current] === doc) return;
        files = { ...files, [current]: doc };
        save(def.id, files);
        root.classList.add('is-dirty');
      },
    });
  });
  if (!exercise) nearView(root, run, '0px');
}

function setupWalkthrough(root: HTMLElement) {
  const def = JSON.parse(root.querySelector('script[data-pg-def]')!.textContent!) as Def;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-aw-file]'));
  const select = (btn: HTMLButtonElement, navigate: boolean) => {
    buttons.forEach((b) => b.setAttribute('aria-current', String(b === btn)));
    root.querySelectorAll<HTMLElement>('[data-aw-pane]').forEach((p) => (p.hidden = p.dataset.awPane !== btn.dataset.awFile));
    if (navigate && btn.dataset.href) frame.send({ type: 'navigate', href: btn.dataset.href });
  };
  const frame = createFrame(root.querySelector('[data-pg-screen]')!, (m) => {
    if (m.type !== 'route') return;
    const path = m.href.split('?')[0];
    const btn = buttons.find((b) => b.dataset.href && b.dataset.href.replace(/\[\w+\]/, '') === path.replace(/[^/]+$/, (seg) => (/^\d+$/.test(seg) ? '' : seg)));
    if (btn) select(btn, false);
  });
  buttons.forEach((b) => b.addEventListener('click', () => select(b, true)));
  root.querySelector('[data-aw-restart]')?.addEventListener('click', () => frame.send({ type: 'run', files: def.files }));
  nearView(root, () => frame.send({ type: 'run', files: def.files }), '0px');
}

export function initPlaygrounds() {
  document.querySelectorAll<HTMLElement>('[data-playground]').forEach(setupPlayground);
  document.querySelectorAll<HTMLElement>('[data-walkthrough]').forEach(setupWalkthrough);
}
```

Route → file sync: a route like `/recipe/3` must select the button whose `data-href` is `/recipe/1` (the sample param). The rule: compare paths with a trailing numeric segment removed on both sides. Simplify the `find` above to:
`const strip = (p: string) => p.replace(/\/\d+$/, '/:id'); buttons.find((b) => b.dataset.href && strip(b.dataset.href) === strip(path))`.
Use this simpler form in the implementation.

- [ ] **Step 4: `src/components/lab/Playground.astro`**: the markup and styles.

```astro
---
/**
 * Live code playground. <Playground ex="e05-counter" /> (exercise: checks, hint, solution)
 * or <Playground ex="demo-use-state" demo /> (editable demo, runs when scrolled into view).
 * Definitions: src/playgrounds/<lab>/<id>.ts
 */
import { Code } from 'astro:components';
import Device from '../Device.astro';
import Icon from '../Icon.astro';
import { inline } from '@/lib/content';
import { getPlayground } from '@/lib/playgrounds';
interface Props { ex: string; demo?: boolean }
const { ex, demo = false } = Astro.props;
const def = getPlayground(ex);
const exercise = !demo && def.checks.length > 0;
const names = Object.keys(def.files);
const themes = { light: 'github-light', dark: 'github-dark-default' } as const;
const json = JSON.stringify({ id: ex, files: def.files, checks: def.checks }).replace(/</g, '\\u003c');
---
<section class:list={['pg', { exercise }]} data-playground data-mode={exercise ? 'exercise' : 'demo'} data-reveal>
  <script type="application/json" data-pg-def set:html={json} />
  <header class="pg-head">
    <span class="pg-kind mono">{exercise ? <><Icon name="target" size={13} /> Exercise</> : <><span class="pg-live" aria-hidden="true"></span> Live demo</>}</span>
    <h4 class="pg-title">{def.title}</h4>
    <span class="pg-pass mono" aria-hidden="true">✓ Solved</span>
  </header>
  {def.goal && <p class="pg-goal" set:html={inline(def.goal)} />}

  <div class="pg-body">
    <div class="pg-code">
      <div class="pg-tabs" role="tablist" aria-label="Files">
        {names.map((f, i) => <button type="button" role="tab" class="pg-tab mono" data-pg-file={f} aria-selected={String(i === 0)}>{f}</button>)}
        <span class="pg-kbd mono" aria-hidden="true">Ctrl ↵ to run</span>
      </div>
      <div class="pg-editor" data-pg-editor>
        <Code code={def.files[names[0]]} lang="tsx" themes={themes} defaultColor={false} />
      </div>
      <div class="pg-bar">
        <button type="button" class="btn btn-primary btn-sm" data-pg-run><Icon name="play" /> Run</button>
        {exercise && <button type="button" class="btn btn-ghost btn-sm" data-pg-check><Icon name="check" /> Check</button>}
        <span class="pg-sp"></span>
        {def.hint && <button type="button" class="pg-link" data-pg-hint aria-expanded="false">💡 Hint</button>}
        {def.solution && <button type="button" class="pg-link" data-pg-sol aria-expanded="false" disabled title="Press Check once to unlock">👁 Solution</button>}
        <button type="button" class="pg-link" data-pg-reset>↺ Reset</button>
      </div>
    </div>
    <div class="pg-phone">
      <Device light interactive label="App preview">
        <div class="pg-screen" data-pg-screen><p class="pg-idle">Press <b>▶ Run</b><br />to start the app</p></div>
      </Device>
    </div>
  </div>

  {def.hint && <div class="pg-hint" data-pg-hint-box hidden><span aria-hidden="true">💡</span><p set:html={inline(def.hint)} /></div>}

  <div class:list={['pg-out', { two: exercise }]}>
    <div class="pg-panel">
      <p class="pg-k mono">Console</p>
      <div class="pg-console mono" data-pg-console aria-live="polite"><span class="pg-empty">console.log output appears here</span></div>
    </div>
    {exercise && (
      <div class="pg-panel">
        <p class="pg-k mono">Checks</p>
        <ol class="pg-checks" data-pg-checks>
          {def.checks.map((c, i) => (
            <li data-state="idle" class="stg" style={`--i:${i}`}>
              <span class="ck" aria-hidden="true"></span>
              <span class="ck-t">{c.name}</span>
              <small class="ck-d" data-detail></small>
            </li>
          ))}
        </ol>
      </div>
    )}
  </div>

  {def.solution && (
    <div class="pg-solution" data-pg-solution hidden>
      {Object.entries(def.solution).map(([f, code]) => <Code code={code} lang="tsx" themes={themes} defaultColor={false} meta={`title="${f} — solution"`} />)}
    </div>
  )}
</section>
```

The `meta` title only works with the site's markdown Shiki transformer, not with `<Code>`. Pass `transformers` instead: `[{ pre(node) { node.properties['data-title'] = `${f} — solution`; } }]`. `app.ts` then shows it as the code-frame header.

Styles (scoped `<style>` in the same file):
- **Card:** `.pg` uses the same card language as `.task`: `border: 1px solid var(--line)`, `border-radius: var(--r-lg)`, `background: var(--surface)`, `overflow: hidden`. Exercises get a 3px left accent rule in `--info`; `.is-passed` turns it `--ok`.
- **Header:** mono uppercase kind label (EXERCISE in `--info`, LIVE DEMO with a pulsing `--accent` dot animated via `opacity` only). `h4` title in `--font-display`. `.pg-pass` badge hidden until `.is-passed`, then pops in (`transform: scale` keyframes).
- **Container query:** `.pg-body { display:grid; grid-template-columns: 1fr }`. At `@container (min-width: 640px)` it becomes `1fr 240px`. The section is the container (`container-type: inline-size`).
- **Editor:** `.pg-editor { height: 340px; overflow: auto; background: var(--code-bg); border-block: 1px solid var(--line) }`. `:global(.cm-editor)` fills it; the placeholder `.code-frame` inside loses its margin and border.
- **Phone:** `.pg-phone { display:grid; place-items:center; padding: 18px; background: radial-gradient(circle at 50% 40%, var(--accent-soft), transparent 60%) }`; the `Device` gets `--w: 220px`. `.pg-screen { position:absolute; inset:0 }` and `iframe { width:100%; height:100%; border:0; display:block; background:#fff }`. `.pg-idle` is centred grey text. `.is-dirty` makes the Run button pulse with `box-shadow` via a keyframe on `::after` opacity.
- **Toolbar:** `.pg-bar` is a flex row with gap 8px and 10px 12px padding. `.pg-link` buttons are small `--text-2` text that turn `--text` on hover, and are disabled at 0.45 opacity.
- **Output panels:** `.pg-out` is a grid; `.two` makes two columns from 720px. `.pg-console` has a 120px max height, scrolls, uses 12px mono, and sets `.warn` to `--warn` and `.error` to `--danger`.
- **Checks:** `.pg-checks li` is a grid with a 18px column and 1fr. The `.ck` dot by `data-state`:
  - idle: an outline ring
  - running: a spinning arc (`transform: rotate`)
  - pass: an `--ok` filled ✓ via `::after`
  - fail: a `--danger` ✕
  `.ck-d` holds the failure detail in `--danger`, 12.5px, spanning the second column.
- **Hint:** an `--info-soft` box. **Solution:** a 16px top margin.
- **Phone width:** under 560px, the toolbar buttons wrap and the Device is 200px wide.

`src/components/Device.astro`: add `interactive?: boolean` to Props, and render `role={interactive ? undefined : 'img'}` and `aria-label={interactive ? undefined : label}`.

- [ ] **Step 5: `src/playgrounds/lab-02/e05-counter.ts`** (full content in Task 4, E5)

- [ ] **Step 6: Register in `src/pages/labs/[id].astro`**
  - Add the imports `Playground`, `AppWalkthrough` and `MockScreen` to the `components` object. `AppWalkthrough` and `MockScreen` come in Task 5; until then, register only `Playground`.
  - In the page `<script>`, add `import { initPlaygrounds } from '@/scripts/playground/controller';` and call `initPlaygrounds()` inside the existing `astro:page-load` listener, before `init` returns early.

- [ ] **Step 7: Temporary verification page** `src/content/labs/lab-02.mdx` with minimal frontmatter (number 2, `draft: false`) and one `<Task n="1.1" title="Counter" time="5 min"><Playground ex="e05-counter" /></Task>`. Open `http://localhost:4321/labs/lab-02` and check:
  - the editor loads
  - Run shows the app in the phone
  - Check runs the checks: the starter fails, and pasting the solution passes and ticks Done
  - dark and light themes both look right
  - at 375px width there's no horizontal scroll

- [ ] **Step 8: Commit** `git commit -m "Add Playground component with lazy editor and auto-checked exercises"`

---

### Task 4: The 11 exercises + demos (content)

**Files:** Create `src/playgrounds/lab-02/` files: `e01-fix-jsx.ts` … `e11-todo-check-delete.ts`, plus `demo-jsx.ts`, `demo-props.ts`, `demo-list.ts`, `demo-use-state.ts`, `demo-use-effect.ts`, `demo-use-ref.ts`, `demo-use-memo.ts`.

Every file has this shape (example: E5, given complete):

```ts
import type { Playground } from '@/lib/playgrounds';

const start = `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <View style={styles.screen}>
      <Text style={styles.count}>{count}</Text>
      <View style={styles.row}>
        {/* TODO 1: "−" button: subtract 1, but never go below 0 */}
        <Pressable style={styles.btn} onPress={() => setCount(count + 1)}>
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
      {/* TODO 2: a "Reset" button that sets the count back to 0 */}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  count: { fontSize: 64, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  btn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  reset: { color: '#2563eb', fontSize: 16 },
});
`;

const solution = start
  .replace(`        {/* TODO 1: "−" button: subtract 1, but never go below 0 */}\n`, `        <Pressable style={styles.btn} onPress={() => setCount(Math.max(0, count - 1))}>\n          <Text style={styles.btnText}>−</Text>\n        </Pressable>\n`)
  .replace(`      {/* TODO 2: a "Reset" button that sets the count back to 0 */}\n`, `      <Pressable onPress={() => setCount(0)}>\n        <Text style={styles.reset}>Reset</Text>\n      </Pressable>\n`);

export default {
  title: 'Counter: +, − and Reset',
  goal: 'Add a **−** button (never below 0) and a **Reset** button. Use the `count` state that is already there.',
  hint: 'Never below 0: `setCount(Math.max(0, count - 1))`. Reset is just `setCount(0)`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Starts at 0', steps: [{ expectText: '0', exact: true }] },
    { name: '+ adds 1', steps: [{ press: '+' }, { expectText: '1', exact: true }] },
    { name: '− subtracts 1', steps: [{ press: '+' }, { press: '+' }, { press: '−' }, { expectText: '1', exact: true }] },
    { name: '− never goes below 0', steps: [{ press: '−' }, { expectText: '0', exact: true }, { expectNoText: '-1' }] },
    { name: 'Reset goes back to 0', steps: [{ press: '+' }, { press: '+' }, { press: 'Reset' }, { expectText: '0', exact: true }] },
  ],
} satisfies Playground;
```

The solution is written out in full (not derived with `.replace`) when the edit isn't a straight swap; derivation is fine when it is. The unit test in Step 2 guarantees each starter differs from its solution.

The exercise list, each with starter → what the student changes → checks:

| File | Starter | Student task | Checks |
|---|---|---|---|
| `e01-fix-jsx` | `App` returns two sibling roots, a bare string inside `View`, and `class="title"` | wrap the siblings in one `View`, put the text in `<Text>`, use `style={styles.title}` | renders without error (`expectText 'Hello'`); shows "Mobile Dev"; `expectCode` `class=` absent (`^(?![\s\S]*class=)`, message "Use style={…}, not class") |
| `e02-props-card` | `Card` component ignores its props; `App` renders one `<Card />` | make `Card({ name, role })` show both; render two cards: "Mariam / Student", "Omar / TA" | each name visible; each role visible; `expectCode 'function Card\\(\\s*\\{'` message "Destructure the props: function Card({ name, role })" |
| `e03-conditional` | `Status({ online })` always shows "Online 🟢"; App renders `<Status online={true} />` and `<Status online={false} />` | use a ternary | `expectText 'Online 🟢'`; `expectText 'Offline 🔴'` |
| `e04-list-keys` | an array `courses` of 4 `{ id, name }` objects; the App shows only `courses[0].name` | `courses.map(c => <Text key={c.id}>…)` | all 4 names visible; `expectCode 'key=\\{'` message "Every item in a list needs a key, e.g. key={c.id}" |
| `e05-counter` | as above | | as above |
| `e06-greeting` | `TextInput` placeholder "Your name" with no state; text "Hello, stranger" | controlled input with `useState`; show "Hello, {name}" (fall back to "stranger" when empty) and "{name.length} characters" | type "Sara" → "Hello, Sara" and "4 characters"; empty → "Hello, stranger" |
| `e07-stopwatch` | `seconds` state, Start/Stop buttons that only set `running`; an empty `useEffect` | in `useEffect` on `[running]`: when running, `setInterval(() => setSeconds(s => s + 1), 1000)` and `return () => clearInterval(id)` | starts at 0 (exact); press Start, wait 1300 → "1" exact; press Stop, wait 1300 → still "1" exact; `expectCode 'clearInterval'` message "Clean up: return () => clearInterval(id)" |
| `e08-focus-ref` | `TextInput` placeholder "Email" and a "Focus the input" button that does nothing | `const inputRef = useRef<TextInput>(null)`, `ref={inputRef}`, `onPress={() => inputRef.current?.focus()}` | press "Focus the input" → `expectFocused 'Email'`; `expectCode 'useRef'` |
| `e09-search-memo` | 6 fruits (Apple, Banana, Cherry, Grape, Orange, Pear), `query` state + `TextInput` placeholder "Search", list shows all fruits | `const visible = useMemo(() => fruits.filter(f => f.toLowerCase().includes(query.toLowerCase())), [query])`; render `visible` | type "re" → `expectText 'Cherry'`, `'Grape'`, `'Orange'`, `'Pear'`, `expectNoText 'Apple'`, `'Banana'`; type "" → Apple back; `expectCode 'useMemo'` |
| `e10-todo-add` | the slides' steps 3–7: `todos` state (`{ id, text, done }[]` with "Learn JSX"), `FlatList` rendering, `TextInput` placeholder "New task" with `useRef` for the text, and an "Add" button whose `addTodo` is empty | `addTodo`: trim; ignore empty; `setTodos([...todos, { id: Date.now().toString(), text, done: false }])`; clear the input | type "Milk", press Add → "Milk"; then `expectText 'Learn JSX'`; type "   " + Add → `expectNoText` of an empty row is hard, so use "the input clears": type "Milk", Add, then `expectCode` checks for a `setText('')` or `clear()` call; plus one more behavioural check: type "", press Add, `expectCode 'trim\\(\\)'` message "Ignore empty tasks: if (!text.trim()) return" |
| `e11-todo-check-delete` | E10's solution plus empty `toggle(id)` and `remove(id)`; each row has a pressable text and a "🗑" button | `toggle`: map + flip `done`; `remove`: filter; done text gets `textDecorationLine: 'line-through'` | press "Learn JSX" → `expectStyle { text:'Learn JSX', prop:'text-decoration-line', includes:'line-through' }`; press 🗑 on the "Read the docs" row → `expectNoText 'Read the docs'` while "Learn JSX" stays. Each row's 🗑 has `testID={'delete-' + item.id}` and the check presses `delete-2` |

E10 uses `useState` for the input text (with `useRef` for focusing it after adding: `inputRef.current?.focus()`), to keep the slides' "input along with a useRef". Its checks:
1. `Adds a task`: type "Milk" into "New task", press "Add", expect "Milk".
2. `Keeps existing tasks`: the same steps, then expect "Learn JSX".
3. `Clears the input`: type "Milk", press Add, then `expectNoText` "Milk" can't be used (the row shows Milk). Instead, add `{ type:'Eggs', into:'New task' }`, press Add, and expect both "Milk" and "Eggs". This proves the second add used the fresh value. Also `expectCode "set\\w*\\(\\s*''\\s*\\)"` with message "Clear the input after adding: setText('')".
4. `Ignores empty tasks`: press Add with an empty input, then `expectCode 'trim\\(\\)'`.

Demos (no checks, no solution; `goal` explains what to try):
- `demo-jsx`: JSX expressions `{2 + 2}`, `{user.name}` and a style object. Try: change the name.
- `demo-props`: `Badge({ label, color })` used three times. Try: add a fourth.
- `demo-list`: `FlatList` with `keyExtractor` and `ItemSeparatorComponent`. Try: add an item.
- `demo-use-state`: a like button whose label changes with state, and a `console.log` on render. Try: watch the console count re-renders.
- `demo-use-effect`: a `useEffect` with `[]` that logs "mounted" and a cleanup that logs "cleanup", and a `useEffect` on `[count]` that logs "count changed". Try: tap and watch the console order.
- `demo-use-ref`: a render counter with `useRef` (`renders.current++`, so no re-render) next to a state counter. Try: see that changing a ref doesn't redraw.
- `demo-use-memo`: an expensive `slowSquare` with a `console.log('computing…')`, plus a theme toggle. Try: the toggle doesn't recompute.

- [ ] **Step 1: Write all 18 files** following the table, each starter with `TODO` comments at the exact edit points.
- [ ] **Step 2: Add the definition test** to `tests/runner.test.ts`:

```ts
import fs from 'node:fs';
import { compile as compileTs } from '../src/runner/modules.ts';

test('every lab-02 playground is well-formed and compiles', async () => {
  const dir = new URL('../src/playgrounds/lab-02/', import.meta.url);
  const ids = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  assert.ok(ids.length >= 18);
  for (const f of ids) {
    const def = (await import(new URL(f, dir).href)).default;
    assert.ok(def.title, `${f}: title`);
    assert.ok(Object.keys(def.files).length, `${f}: files`);
    for (const [name, code] of Object.entries({ ...def.files, ...(def.solution ?? {}) })) compileTs(code as string, `${f}:${name}`);
    if (f.startsWith('e')) {
      assert.ok(def.checks?.length >= 2, `${f}: needs checks`);
      assert.ok(def.solution, `${f}: needs a solution`);
      assert.notDeepEqual(def.files, def.solution, `${f}: starter equals solution`);
    }
  }
});
```

`recipes.ts` (Task 5) has no `checks`, and its name doesn't start with `e`.
- [ ] **Step 3: `npm test` → PASS.**
- [ ] **Step 4: End-to-end in the scratchpad** with `e2e.mjs`, using playwright-core and the system Chrome. It loads `/runner/index.html` in a test page. For each exercise it posts `check` with the solution files (expect all pass) and with the starter files (expect at least one fail); for each demo it posts `run` (expect no `error` message). It prints a table and exits non-zero on any mismatch.
- [ ] **Step 5: Commit** `git commit -m "Add Lab 02 exercises and demos"`

---

### Task 5: Recipes app + AppWalkthrough + MockScreen

**Files:** Create `src/playgrounds/lab-02/recipes.ts`, `src/components/lab/AppWalkthrough.astro`, `src/components/lab/MockScreen.astro`; register both in `[id].astro`.

**Recipes files** (each a template-literal string, all valid in a real Expo tabs project):
- `data/recipes.ts`: `export type Recipe = { id: string; title: string; emoji: string; minutes: number; ingredients: string[]; steps: string[] }`. Six recipes: Koshari 🍝, Shakshuka 🍳, Falafel 🧆, Lentil Soup 🥣, Fattah 🍚 and Basbousa 🍰, each with 3–5 ingredients and 3 steps.
- `context/recipes.tsx`: `RecipesProvider` holds `recipes` (`useState(initial)`) and `favorites` (`useState<string[]>([])`). It exposes `toggleFavorite(id)`, `isFavorite(id)` and `addRecipe({ title, emoji, minutes })` (generates `id: String(Date.now())`). `useRecipes()` throws a friendly error outside the provider.
- `components/RecipeCard.tsx`: `RecipeCard({ recipe })` is a `Link` with `asChild` around a `Pressable` showing the emoji, title, "⏱ {minutes} min" and a ♥ when it's a favourite.
- `app/_layout.tsx`: `<RecipesProvider><Stack><Stack.Screen name="(tabs)" options={{ headerShown: false }} /><Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} /></Stack></RecipesProvider>`.
- `app/(tabs)/_layout.tsx`: `<Tabs screenOptions={{ tabBarActiveTintColor: '#e8590c' }}>` with `index` (title "Recipes", icon 🍽), `favorites` ("Favorites", ♥) and `add` ("Add", ＋). Icons are `<Text style={{ fontSize: size, color }}>`.
- `app/(tabs)/index.tsx`: a `TextInput` (placeholder "Search recipes") and `useMemo` filtering, feeding a `FlatList` of `RecipeCard`, with an empty-state text.
- `app/(tabs)/favorites.tsx`: `recipes.filter(r => isFavorite(r.id))`, a count line ("2 favorites") and the empty state "No favorites yet: tap ♡ on a recipe".
- `app/(tabs)/add.tsx`:
  - Fields: Title (`useRef` focus on error), Emoji and Minutes.
  - Validation: title required; minutes must be a positive number. Errors show in red.
  - On success: `addRecipe`, clear the fields, then `router.push('/')`.
- `app/recipe/[id].tsx`: `useLocalSearchParams<{ id: string }>()`, find the recipe and show "Recipe not found" if there's none. Then `<Stack.Screen options={{ title: recipe.title }} />`, a big emoji, the minutes, a ♡/♥ toggle button ("Add to favorites" / "Remove from favorites"), and numbered ingredients and steps.

`tree` (order + notes + where the phone navigates; notes link back to the tasks):
- `app/_layout.tsx`: "Root **Stack** wraps everything in `RecipesProvider`, so every page shares the same favorites (Task 5.3)."
- `app/(tabs)/_layout.tsx`: "**Tabs** layout: the bottom bar. Each file in `(tabs)/` becomes a tab. `(tabs)` is a group, so it's not part of the URL." (href `/`)
- `app/(tabs)/index.tsx`: "**Page 1, Home.** `FlatList` + search with `useMemo` (E9)." (href `/`)
- `app/recipe/[id].tsx`: "**Page 2, Details.** `[id]` is a route param read with `useLocalSearchParams` (Task 5.2)." (href `/recipe/1`)
- `app/(tabs)/favorites.tsx`: "**Page 3, Favorites.** Reads the shared state from Context." (href `/favorites`)
- `app/(tabs)/add.tsx`: "**Page 4, Add.** A form with `useState`, `useRef` and validation, then `router.push` (E6, E8)." (href `/add`)
- `components/RecipeCard.tsx`: "A reusable component with **props** (E2), wrapped in `Link` to open Details."
- `context/recipes.tsx`: "`createContext` + a custom hook `useRecipes()`: state that many pages share."
- `data/recipes.ts`: "Plain data with a TypeScript type."

**AppWalkthrough.astro** (props `ex: string`):
- **Structure:** `section.aw[data-walkthrough][data-reveal]` containing a `script[data-pg-def]` (`{ id, files, checks: [] }`) and a grid.
- **Left: tree.** `nav.aw-tree`. A folder label is rendered whenever the directory changes, with the depth indent from `/` count. Each item is `button[data-aw-file][data-href]`; the first gets `aria-current="true"`.
- **Middle: panes.** One `div[data-aw-pane]` per file: `p.aw-note` (`inline(note)`) plus `<Code>` with a `data-title` transformer. Every pane except the first is `hidden`.
- **Right: phone.** `Device light interactive` with `div.pg-screen[data-pg-screen]`, a caption "Tap around: it's live", and a "↺ Restart app" button `[data-aw-restart]`.
- **Layout:** `container-type: inline-size`. At ≥ 900px the columns are `200px 1fr 250px`. Smaller widths stack: the tree turns into a horizontally scrollable row of chips (`overflow-x: auto`, no page scroll), then the code, then the phone.
- **Code pane:** max-height 460px, scrolls.
- **Motion:** tree buttons stagger in with `.stg`; switching panes fades in (`opacity`, translateY 6px).

**MockScreen.astro** (props `title`, `rows?: string[]`, `tab?: 0|1|2`, `variant?: 'list'|'detail'|'form'|'empty'`, `caption?`):
- **Frame:** a `Device light` with a header bar (title) and a body:
  - **list:** rows as cards with an emoji and text
  - **detail:** a big emoji, the first row as the title, the rest as lines, and a pill button
  - **form:** rows as labelled input boxes and a primary button
  - **empty:** a centred grey text
- **Tab bar:** a three-tab bar (🎬 Movies · ⭐ Watchlist · ＋ Add) when `tab` is set, with the active tab in orange.
- **Motion:** `.stg` stagger in a `data-reveal` figure; a `figcaption` in mono.

- [ ] **Step 1: Write `recipes.ts`** and add to `e2e.mjs`:
  - run the recipes app with no error
  - press "Koshari" and expect the "Add to favorites" text
  - press it and expect "Remove from favorites"
  - press "‹ Back", press "Favorites", expect "Koshari"
  - press "Add", press "Save recipe" with an empty title, expect "Title is required"
  - type "Molokhia" into "Title" and "30" into "Minutes", press "Save recipe", expect "Molokhia" on Home
  Use the runner's `check` message with a one-off check to drive these steps.
- [ ] **Step 2: Write `AppWalkthrough.astro` and `MockScreen.astro`**, register them, and verify in the browser that clicking files navigates the phone and tapping in the phone selects the file.
- [ ] **Step 3: `npm test`, then e2e → PASS. Commit** `git commit -m "Add live Recipes walkthrough and Movies mock screens"`

---

### Task 6: Lab 02 MDX content

**Files:** Replace the temporary `src/content/labs/lab-02.mdx` with the full lab.

Frontmatter:

```yaml
number: 2
title: 'React & React Native: Syntax, Hooks & Your First Multi-Page App'
description: 'Learn JSX, components, props and hooks by running code right on this page, build the To-Do list from the slides, explore a live 4-page Recipes app, then build your own 4-page Movies app.'
difficulty: Beginner
estimatedTime: 3 hours
skills: [JSX, Components, Props, useState, useEffect, useRef, useMemo, Expo Router]
roadmapStage: mobile-ui
objectives:
  - Explain what React is and why apps are built from components
  - Write correct JSX and pass data with props
  - Render lists with keys and show things conditionally
  - Manage state and side effects with useState, useEffect, useRef and useMemo
  - Navigate between pages with Expo Router (Stack, Tabs, route params)
  - Build a 4-page app on your own
prerequisites:
  - '[Lab 01](/labs/lab-01) completed: Expo app running on your phone, Git set up'
  - '**Expo Go** on your phone, or the Android emulator'
  - 'A GitHub account and a token (Lab 01, Task 4.5)'
troubleshooting: (6 entries)
  - '"Text strings must be rendered within a <Text> component"' / text placed directly in a View / wrap it in <Text>
  - '"Each child in a list should have a unique key prop"' / .map() without key / add key={item.id}, or keyExtractor on FlatList
  - '"Too many re-renders"' / calling setState during render, e.g. onPress={setCount(1)} / pass a function: onPress={() => setCount(1)}
  - 'Rendered more / fewer hooks than expected' / a hook inside an if / loop / call hooks at the top of the component, always in the same order
  - 'The app keeps re-rendering or fetching forever' / useEffect without a dependency array that sets state / add [] or the right dependencies
  - '"Unmatched route" / page not found' / the file isn't in app/ or the href is wrong / check the file name; e.g. app/movie/[id].tsx ↔ href `/movie/3`
submission:
  - 'Link to your **movies-app** GitHub repo with the `feature/movies-app` branch merged into `main`'
  - 'One screenshot of each of the 4 pages running on your phone'
  - 'All 11 exercises on this page show **✓ Solved**: show your TA before you leave'
extraChallenge: 'Make the watchlist survive an app restart: save it with `@react-native-async-storage/async-storage` in a `useEffect`, and load it when the app starts.'
resources: React docs (Describing the UI, Adding interactivity, Built-in hooks), React Native core components, Expo Router introduction, Expo Router tabs.
```

Body outline (each Task has short prose + visuals; the time values sum per Part):

- **Part 1: React in one picture (15 min)**
  - **1.1 Single-page apps (4 min).** `Cards cols=2`: Multi-page (every click = a new page from the server, `- ` reloads) vs Single-page (`+ ` instant, app-like; `- ` bigger first load; `- ` more complex routing). A mobile app is always "single-page" and the screens swap inside it.
  - **1.2 What React is (4 min).** A UI library by Meta; you describe *what* the screen looks like for the current data, and React updates it. Component tree as a `FileTree` (`App → Header, TodoList → TodoItem ×3, AddForm`).
  - **1.3 Function vs class components (3 min).** Two code blocks side by side (class with `this.state` and `render()`; function with `useState`). Callout `[!NOTE]`: we only write function components plus hooks (since React 16.8).
  - **1.4 React (web) → React Native (4 min).** `Cards` mapping `div→View`, `p/span→Text`, `img→Image`, `input→TextInput`, `button→Pressable`, `ul + map→FlatList`, `CSS→StyleSheet` (flexbox, column by default, no px units). A `[!TIP]` saying the same React skills work in both.
- **Part 2: JSX & components (30 min)**
  - **2.1 JSX rules (8 min).** `Explain` the parts of `<Text style={styles.title}>Hello {name}</Text>`. Then 4 rules as compact `Cards`: one parent (or `<>…</>`), `{}` for JS expressions, `style={{…}}` not `class`, every tag closes (`<Image />`). `<Playground ex="demo-jsx" demo />`, then `<Playground ex="e01-fix-jsx" />`.
  - **2.2 Components & props (8 min).** Props flow down, like function arguments; `children`. `<Playground ex="demo-props" demo />` then `e02-props-card`.
  - **2.3 Conditional rendering (5 min).** `cond ? a : b` and `cond && a`. Exercise `e03-conditional`.
  - **2.4 Lists & keys (9 min).** `.map()` + `key`, then `FlatList` for long lists (`data`, `renderItem`, `keyExtractor`). `<Playground ex="demo-list" demo />` then `e04-list-keys`.
- **Part 3: Hooks (45 min)**
  - **3.1 Hooks in one picture (3 min).** `Cards` for the 4 hooks from the slides (useState, useEffect, useRef, useMemo), each with a one-line "use it when…". Rules of hooks callout: top level only, only in components and custom hooks.
  - **3.2 useState (12 min).** `Explain` `const [count, setCount] = useState(0)`. Setting state re-renders. Use updater `setCount(c => c + 1)` when the new value depends on the old. Events: `onPress`, `onChangeText`, and passing a function, not calling it. `demo-use-state`, `e05-counter`, `e06-greeting`.
  - **3.3 useEffect (12 min).** Side effects (timers, fetch, subscriptions); dependency array table (no array / `[]` / `[x]`); cleanup = the old `componentWillUnmount`. `demo-use-effect`, `e07-stopwatch`. Fetch example code block (not run) with `useEffect` + `fetch` + loading state.
  - **3.4 useRef (8 min).** Two uses: grab a component (focus) and keep a value without re-rendering. `demo-use-ref`, `e08-focus-ref`.
  - **3.5 useMemo (10 min).** Cache a calculated value until its dependencies change. `demo-use-memo`, `e09-search-memo`. `[!TIP]` don't memo everything, only slow work or big lists.
- **Part 4: Practical: To-Do List (20 min)**
  - **4.1 The plan (3 min).** The slides' list of what we build, with `Cards`: add, list, check, delete, mapped to state/props/hooks. A small `Timeline` of steps 3–8 from the slides.
  - **4.2 Add a task (9 min).** `e10-todo-add`.
  - **4.3 Challenge: check + delete (8 min).** `e11-todo-check-delete`. `Checkpoint` "Your To-Do list does full CRUD minus edit, all in one component".
- **Part 5: Navigation + the Recipes app (30 min)**
  - **5.1 Routing on mobile (6 min).** The slides' React Router (URL → component) becomes Expo Router (file → screen). A `FileTree` of `app/` with arrows to URLs. `Cards`: Stack (push/back), Tabs (bottom bar), `Link`/`router.push`.
  - **5.2 Route params (5 min).** `[id].tsx`, `useLocalSearchParams`. `Explain` on `<Link href={'/recipe/' + recipe.id}>` and the `{ pathname, params }` form. A callout that params are always strings.
  - **5.3 Sharing state between pages (5 min).** Context in 3 steps (`createContext`, Provider in `_layout`, `useContext` via a custom hook) with a code block.
  - **5.4 Walk through the Recipes app (14 min).** `<AppWalkthrough ex="recipes" />`, then a numbered list of things to try (favourite a recipe and see it in Favorites, add a recipe, use Back).
- **Part 6: Your turn: Movies app (40 min)**
  - **6.1 Create the project (5 min).**
    - Terminal: `npx create-expo-app@latest movies-app --template tabs`, `cd movies-app`, `npx expo start`.
    - `FileTree` of the target structure (`app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `index.tsx`, `watchlist.tsx`, `add.tsx`, `app/movie/[id].tsx`, `components/MovieCard.tsx`, `context/movies.tsx`, `data/movies.ts`), marking files to delete from the template as `-`.
    - Terminal: `git init`/branch is not needed because create-expo-app already ran `git init`; run `git switch -c feature/movies-app`.
    - Code block `data/movies.ts` with 6 movies (`id`, `title`, `year`, `genre`, `rating`, `emoji`).
  - **6.2 Page 1: Movies (8 min).** Requirements as a `Cards` points list (`+ ` items); `MockScreen` list with tab 0; commit command.
  - **6.3 Page 2: Movie details (8 min).** Requirements; `MockScreen` detail; commit.
  - **6.4 Page 3: Watchlist (7 min).** Requirements (count in header via `Tabs.Screen` title or a Text, empty state); two `MockScreen`s (list + empty) with tab 1; commit.
  - **6.5 Page 4: Add movie (7 min).** Requirements (title required, year numeric 1900–2030, genre; on save add + `router.push('/')`); `MockScreen` form, tab 2; commit.
  - **6.6 Push & merge (5 min).** `GitFlow` from Lab 01 with branch `feature/movies-app` (current 4); a terminal block for push; the same PR flow as Lab 01 Task 4.9; then `git switch main` and `git pull`. `Checkpoint` mission complete.

MDX safety rules:
- Never write a bare `{`/`}` or `<Tag>` in prose; use backticks.
- Never put `>` inside a `Task`/`Part` `title` (the outline parser stops at the first `>`).
- Apostrophes in titles are fine (double-quoted attributes).

- [ ] **Step 1: Write the MDX.**
- [ ] **Step 2: Visual check in the browser**, in both themes and at 375px width:
  - the plan bar shows 6 parts
  - the tracker lists all tasks
  - solving an exercise ticks its task and updates the ring
- [ ] **Step 3: `npm run build` → success.** Then `npm test` passes and the e2e run is green.
- [ ] **Step 4: Commit** `git commit -m "Add Lab 02: React & React Native syntax, hooks and multi-page apps"`

---

### Task 7: Docs + final verification

**Files:** Modify `README.md` (document `<Playground>`, `<AppWalkthrough>`, `<MockScreen>`, the exercise file format and check steps, and the runner architecture under the "Visual labs" section).

- [ ] **Step 1: README section** "Interactive playgrounds (Lab 02)" covering:
  - the component table rows
  - an exercise file example
  - the step vocabulary from `protocol.ts`
  - that `public/runner/runtime.js` is generated by `src/integrations/runner.mjs` on `astro dev`/`build`
- [ ] **Step 2: Full verification:**
  - `npm test`
  - `npm run build`
  - e2e in the scratchpad
  - manual pass through the lab in the browser, in dark and light themes, at phone width, with reduced motion emulated
  - check that the Lab 01 page is unchanged
- [ ] **Step 3: Commit + push the branch.**
  `git commit -m "Document Lab 02 playgrounds"`
  `git push -u origin lab-02`
  The push publishes to GitHub and creates a Vercel preview, so confirm with the user before pushing.
