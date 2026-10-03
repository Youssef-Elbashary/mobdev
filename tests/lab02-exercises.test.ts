// Every Lab 02 exercise: reference solutions pass, starters don't, typical mistakes get the right feedback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { evaluate, lintFiles } = await import('../src/lab/engine/checks.ts');
const grade = await import('../src/lab/engine/grade.ts');
const { exercises, demos } = await import('../src/lab/exercises/lab-02/index.ts');
const { EXERCISE_IDS } = await import('../src/lab/exercises/lab-02/meta.ts');
const { solutions, mistakes } = await import('./support/lab02-solutions.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');

type Ex = (typeof exercises)[number];

/** AppRunner backed by the real preview runtime in happy-dom. */
function nodeRunner() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const messages: { type: string; error?: { message: string } }[] = [];
  const runtime = createRuntime({ container, post: (m) => messages.push(m as never) });
  let id = 0;
  return {
    async run(files: Record<string, string>, entry: string, frame: 'phone' | 'web') {
      messages.length = 0;
      await runtime.run({ type: 'run', id: ++id, files, entry, frame });
      const error = messages.find((m) => m.type === 'error')?.error;
      return error ? { ok: false, error } : { ok: true };
    },
    driver: {
      text: () => runtime.driver.text(),
      find: (q?: object) => runtime.driver.find(q),
      count: (q?: object) => runtime.driver.count(q),
      press: (q?: object) => runtime.driver.press(q),
      type: (q: object, v: string) => runtime.driver.type(q, v),
      wait: (ms: number) => runtime.driver.wait(ms),
      logs: async () => [],
      rerun: async () => {
        await runtime.rpc('rerun', []);
      },
    },
  };
}

const codeExercises = exercises.filter((e): e is Extract<Ex, { kind: 'code' | 'fix' }> => e.kind === 'code' || e.kind === 'fix');
const byId = (id: string) => exercises.find((e) => e.id === id)!;

test('registry ids match meta.ts, in page order, numbered 1…17', () => {
  assert.deepEqual(exercises.map((e) => e.id), EXERCISE_IDS);
  assert.deepEqual(exercises.map((e) => e.n), exercises.map((_, i) => i + 1));
  for (const e of exercises) assert.equal(e.hints.length, 3, `${e.id} has 3 hints`);
});

for (const ex of codeExercises) {
  test(`${ex.id} ${ex.title}: the reference solution passes every check`, async () => {
    const files = solutions[ex.id];
    assert.ok(files, `solution for ${ex.id} exists`);
    const out = await evaluate(ex, files, nodeRunner());
    assert.equal(out.status, 'pass', JSON.stringify({ failed: out.results.filter((r) => !r.pass), blocker: out.blocker }, null, 1));
  });

  test(`${ex.id}: the starter code is not accepted (and doesn't crash the checker)`, async () => {
    const out = await evaluate(ex, ex.files, nodeRunner());
    assert.notEqual(out.status, 'pass');
    assert.equal(out.results.length, ex.checks.length);
    for (const r of out.results) if (!r.pass) assert.ok(r.message && r.message.length > 10, `${ex.id}/${r.id} has a teaching message`);
  });
}

for (const m of mistakes) {
  test(`${m.ex} mistake — ${m.name}`, async () => {
    const out = await evaluate(byId(m.ex) as never, m.files, nodeRunner());
    const failed = out.results.filter((r) => !r.pass).map((r) => r.id);
    for (const id of m.fails) assert.ok(failed.includes(id), `${id} should fail; failed = ${failed}`);
    for (const id of m.passes ?? []) assert.ok(!failed.includes(id), `${id} should pass; failed = ${failed}`);
    if (m.message) assert.ok(out.results.some((r) => r.message && m.message!.test(r.message)), `a message matches ${m.message}`);
    assert.notEqual(out.status, 'pass');
    if (m.passes?.length) assert.equal(out.status, 'partial');
  });
}

test('starter files compile (students start from code that runs or shows a clear error)', () => {
  for (const ex of codeExercises) {
    const c = compileAll(ex.files);
    assert.ok(c.ok, `${ex.id} starter compiles: ${JSON.stringify(!c.ok && c.errors)}`);
  }
});

test('every demo runs without errors', async () => {
  for (const demo of Object.values(demos)) {
    const runner = nodeRunner();
    const compiled = compileAll(demo.files);
    assert.ok(compiled.ok, `${demo.id} compiles`);
    const r = await runner.run(compiled.ok ? compiled.files : {}, demo.entry, demo.frame);
    assert.equal(r.ok, true, `${demo.id}: ${JSON.stringify(r.error)}`);
    assert.ok((await runner.driver.text()).length > 0, `${demo.id} shows something`);
  }
});

test('lint: a component used without importing it is flagged on its line', () => {
  const d = lintFiles({ 'App.tsx': `import { View } from 'react-native';\nexport default function App() {\n  return <View><Text>Hi</Text></View>;\n}` });
  assert.equal(d.length, 1);
  assert.equal(d[0].line, 3);
  assert.match(d[0].message, /<Text> is used but never imported/);
  const hooks = lintFiles({ 'App.tsx': `export default function App() { const [a, setA] = useState(0); return null; }` });
  assert.match(hooks[0].message, /useState isn't imported/);
});

// ---------------------------------------------------------------- non-code exercises
test('ex01 order: correct order passes, a swap is partial with a pointer to the first wrong step', () => {
  const ex = byId('ex01') as never as Parameters<typeof grade.gradeOrder>[0];
  assert.equal(grade.gradeOrder(ex, ex.items).status, 'pass');
  const swapped = [...ex.items];
  [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
  const out = grade.gradeOrder(ex, swapped);
  assert.equal(out.status, 'partial');
  assert.match(out.results.find((r) => !r.pass)!.message!, /Steps 1–1 are right. Step 2/);
});

test('ex02 label: ProductCard on both cards; a wrong name explains why', () => {
  const ex = byId('ex02') as never as Parameters<typeof grade.gradeLabel>[0];
  const right = Object.fromEntries(ex.zones.map((z) => [z.id, z.answer]));
  assert.equal(grade.gradeLabel(ex, right).status, 'pass');
  const out = grade.gradeLabel(ex, { ...right, card2: 'Header' });
  assert.equal(out.status, 'partial');
  assert.match(out.results.find((r) => r.id === 'card2')!.message!, /same ProductCard/);
});

test('ex06 predict: right answers pass; a wrong pick teaches', () => {
  const ex = byId('ex06') as never as Parameters<typeof grade.gradePredict>[0];
  const right = ex.questions.map((q) => q.options.findIndex((o) => o.correct));
  assert.equal(grade.gradePredict(ex, right).status, 'pass');
  const out = grade.gradePredict(ex, [2, right[1]]);
  assert.equal(out.status, 'partial');
  assert.match(out.results[0].message!, /no\*\* array|after every render/);
});

test('ex12 match: decoy classes get their own explanation', () => {
  const ex = byId('ex12') as never as Parameters<typeof grade.gradeMatch>[0];
  const right = Object.fromEntries(ex.pairs.map((p) => [p.target, p.chip]));
  assert.equal(grade.gradeMatch(ex, right).status, 'pass');
  const out = grade.gradeMatch(ex, { ...right, 'Bold text': 'text-bold' });
  assert.match(out.results.find((r) => r.label === 'Bold text')!.message!, /isn’t a real class — Weight uses `font-`/);
});

test('ex11 flex: rounds pass only when all three properties match', () => {
  const ex = byId('ex11') as never as Parameters<typeof grade.gradeFlexRound>[0];
  assert.equal(grade.gradeFlexRound(ex, 1, ex.rounds[1]).pass, true);
  const r = grade.gradeFlexRound(ex, 1, { ...ex.rounds[1], alignItems: 'center' });
  assert.equal(r.pass, false);
  assert.match(r.message!, /alignItems/);
  assert.match(grade.gradeFlexRound(ex, 1, { ...ex.rounds[1], flexDirection: 'column' }).message!, /row/);
});
