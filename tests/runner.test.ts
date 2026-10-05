// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile, resolve, createModuleSystem } from '../src/runner/modules.ts';
import { buildRoutes, matchRoute, childName, hrefOf, buildHref } from '../src/runner/routes.ts';

/* ---------------- modules ---------------- */

test('compile turns TSX + imports into CommonJS with the automatic JSX runtime', () => {
  const out = compile(`import { View } from 'react-native';\nconst n: number = 1;\nexport default () => <View />;`, 'App.tsx');
  assert.match(out, /require\(['"]react-native['"]\)/);
  assert.match(out, /require\(['"]react\/jsx-runtime['"]\)/);
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
  const withBuiltin = createModuleSystem({ 'App.tsx': `import { x } from 'lib';\nexport default x;` }, { lib: { x: 42 } });
  assert.equal(withBuiltin.require('App.tsx').default, 42);
});

// (imports must be used: like TypeScript, Sucrase drops imports that are never used)
test('module system gives friendly errors', () => {
  const sys = createModuleSystem({ 'App.tsx': `import x from 'lodash';\nexport default x;` }, {});
  assert.throws(() => sys.require('App.tsx'), /lodash.*isn't available/);
  const bad = createModuleSystem({ 'App.tsx': `const = 1;` }, {});
  assert.throws(() => bad.require('App.tsx'), /^(?!.*App\.tsx.*App\.tsx).*App\.tsx.*\(1:7\)/);
  const missing = createModuleSystem({ 'App.tsx': `import x from './nope';\nexport default x;` }, {});
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

/* ---------------- playground definitions ---------------- */

test('every lab-02 playground is well-formed and its code compiles', async () => {
  const dir = new URL('../src/playgrounds/lab-02/', import.meta.url);
  const ids = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  assert.ok(ids.length >= 18, `expected ≥ 18 playgrounds, found ${ids.length}`);
  for (const f of ids) {
    const def = (await import(new URL(f, dir).href)).default;
    assert.ok(def.title, `${f}: title`);
    assert.ok(Object.keys(def.files).length, `${f}: files`);
    for (const [name, code] of Object.entries({ ...def.files, ...(def.solution ?? {}) })) {
      assert.doesNotThrow(() => compile(code as string, name), `${f} → ${name} does not compile`);
    }
    if (/^e\d+/.test(f)) {
      assert.ok(def.checks?.length >= 2, `${f}: needs at least 2 checks`);
      assert.ok(def.solution, `${f}: needs a solution`);
      assert.notDeepEqual(def.files, def.solution, `${f}: the starter is already the solution`);
      for (const c of def.checks) for (const s of c.steps) if ('expectCode' in s) new RegExp(s.expectCode, s.flags);
    }
  }
});

test('code checks ignore comments (TODOs often contain the answer)', async () => {
  const { stripComments } = await import('../src/runner/checks.ts');
  const src = `// TODO: const ref = useRef(null);\nconst url = 'https://x.dev';\n{/* use key={id} */}\nconst a = 1; // trailing\n/* block\n useMemo( */`;
  const out = stripComments(src);
  assert.doesNotMatch(out, /useRef|key=|useMemo|trailing/);
  assert.match(out, /https:\/\/x\.dev/);
  assert.match(out, /const a = 1;/);
});
