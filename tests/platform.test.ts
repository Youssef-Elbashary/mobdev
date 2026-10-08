// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileLab, compileModule, emptyFlow, labKey, orderFlow, parseAssessment, parseChecks, sanitizeFlow, slugify, splitLabKey, type Flow } from '../src/lib/platform/core.ts';
import { labStructure } from '../src/lib/progress/core.ts';
import { parseModuleBanner } from '../src/lib/platform/banner.ts';

const lab: Flow = {
  nodes: [
    { id: 'root', type: 'start', x: 0, y: 0, data: { title: 'Intro to Kotlin', description: 'First steps', difficulty: 'Beginner', estimatedTime: '2 hours', objectives: 'Run Kotlin\n\nUse val' } },
    { id: 'p1', type: 'part', x: 1, y: 0, data: { title: 'Setup', time: '15 min' } },
    { id: 't1', type: 'task', x: 2, y: 0, data: { title: 'Install the JDK', time: '5 min', body: 'Download it.' } },
    { id: 'c1', type: 'checkpoint', x: 3, y: 0, data: { body: 'java -version works' } },
    { id: 't2', type: 'task', x: 4, y: 0, data: { title: 'Counter', time: '10 min', body: '' } },
    { id: 'e1', type: 'exercise', x: 5, y: 0, data: { title: 'Counter', checks: 'adds :: press +; expect exact 1', starter: 'a', solution: 'b' } },
    { id: 'r1', type: 'repo', x: 6, y: 0, data: {} },
    { id: 'ci', type: 'checkin', x: 7, y: 0, data: {} },
    { id: 'draft', type: 'text', x: 9, y: 9, data: { body: 'not connected' } },
  ],
  edges: [
    { from: 'root', to: 'p1' }, { from: 'p1', to: 't1' }, { from: 't1', to: 'c1' }, { from: 'c1', to: 't2' },
    { from: 't2', to: 'e1' }, { from: 'e1', to: 'r1' }, { from: 'r1', to: 'ci' },
  ],
};

test('slugify and lab keys', () => {
  assert.equal(slugify('Web Development 2!'), 'web-development-2');
  assert.equal(slugify('  '), 'item');
  assert.equal(labKey('web-dev', 'lab-01'), 'web-dev--lab-01');
  assert.deepEqual(splitLabKey('web-dev--lab-01'), { module: 'web-dev', lab: 'lab-01' });
  assert.equal(splitLabKey('lab-01'), null, 'file-based labs are not builder labs');
});

test('orderFlow follows edges from the root and skips unconnected drafts', () => {
  assert.deepEqual(orderFlow(lab, 'lab').map((n) => n.id), ['root', 'p1', 't1', 'c1', 't2', 'e1', 'r1', 'ci']);
  const cyclic: Flow = { nodes: lab.nodes.slice(0, 3), edges: [{ from: 'root', to: 'p1' }, { from: 'p1', to: 't1' }, { from: 't1', to: 'p1' }] };
  assert.deepEqual(orderFlow(cyclic, 'lab').map((n) => n.id), ['root', 'p1', 't1']);
});

test('compileLab numbers parts and tasks, nests content in tasks and collects graded exercises', () => {
  const c = compileLab(lab, 'kotlin--lab-01');
  assert.equal(c.meta.title, 'Intro to Kotlin');
  assert.deepEqual(c.meta.objectives, ['Run Kotlin', 'Use val']);
  assert.deepEqual(c.blocks.map((b) => b.kind), ['part', 'task', 'task', 'repo', 'checkin']);
  const t2 = c.blocks[2] as Extract<(typeof c.blocks)[number], { kind: 'task' }>;
  assert.equal(t2.n, '1.2');
  assert.deepEqual(t2.children.map((b) => b.kind), ['exercise']);
  assert.ok(c.exercises['kotlin--lab-01--e1']);
  assert.deepEqual(c.exercises['kotlin--lab-01--e1'].checks, [{ name: 'adds', steps: [{ press: '+' }, { expectText: '1', exact: true }] }]);
  assert.equal(c.hasCheckin, true);
  assert.deepEqual(c.warnings, []);
});

test('the compiled outline drives the existing progress tracker', () => {
  const c = compileLab(lab, 'kotlin--lab-01');
  const s = labStructure('kotlin--lab-01', 'Intro to Kotlin', c.outline, (id) => (c.exercises[id] ? { title: c.exercises[id].title, checks: c.exercises[id].checks.length } : null));
  assert.deepEqual(s.tasks, [{ n: '1.1', title: 'Install the JDK' }, { n: '1.2', title: 'Counter' }]);
  assert.deepEqual(s.exercises, [{ id: 'kotlin--lab-01--e1', task: '1.2', title: 'Counter', checks: 1 }]);
  assert.equal(s.hasSubmission, true);
});

test('a task before any part gets an automatic Part 1; exercises without checks are ungraded demos', () => {
  const f: Flow = {
    nodes: [{ id: 'root', type: 'start', x: 0, y: 0, data: {} }, { id: 't', type: 'task', x: 0, y: 0, data: { title: 'Go' } }, { id: 'e', type: 'exercise', x: 0, y: 0, data: { title: 'Try', checks: '' } }],
    edges: [{ from: 'root', to: 't' }, { from: 't', to: 'e' }],
  };
  const c = compileLab(f, 'm--l');
  assert.deepEqual(c.blocks.map((b) => b.kind), ['part', 'task']);
  assert.ok(!c.outline.includes('<Playground'));
  assert.equal(c.warnings.length, 1);
});

test('parseChecks understands the mini-language and reports bad lines', () => {
  const r = parseChecks('Types :: type Ali into Name; expect Hello Ali\n# comment\nNo error :: not exact Error; wait 200\nUses state :: code /useState\\(/ use useState');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value[0].steps, [{ type: 'Ali', into: 'Name' }, { expectText: 'Hello Ali' }]);
    assert.deepEqual(r.value[1].steps, [{ expectNoText: 'Error', exact: true }, { wait: 200 }]);
    assert.deepEqual(r.value[2].steps, [{ expectCode: 'useState\\(', flags: undefined, message: 'use useState' }]);
  }
  assert.equal(parseChecks('no separator').ok, false);
  assert.equal(parseChecks('x :: dance').ok, false);
  assert.equal(parseChecks('x :: code /([/ broken').ok, false);
});

test('sanitizeFlow keeps a valid chain and rejects broken flows', () => {
  const ok = sanitizeFlow(lab, 'lab');
  assert.equal(ok.ok, true);
  assert.equal(sanitizeFlow({ nodes: [] }, 'lab').ok, false, 'needs a root');
  assert.equal(sanitizeFlow({ nodes: [...lab.nodes, { ...lab.nodes[0], id: 'root2' }], edges: [] }, 'lab').ok, false, 'one root only');
  assert.equal(sanitizeFlow({ nodes: [{ id: 'root', type: 'start', data: {} }, { id: 'x', type: 'virus', data: {} }] }, 'lab').ok, false);
  assert.equal(sanitizeFlow({ nodes: [{ id: 'root', type: 'start', data: { title: 'x'.repeat(121) } }] }, 'lab').ok, false);
  // forks, edges into the root and out of a check-in are dropped
  const r = sanitizeFlow({
    nodes: [{ id: 'root', type: 'start', data: {} }, { id: 'a', type: 'text', data: {} }, { id: 'b', type: 'text', data: {} }, { id: 'c', type: 'checkin', data: {} }],
    edges: [{ from: 'root', to: 'a' }, { from: 'root', to: 'b' }, { from: 'a', to: 'root' }, { from: 'a', to: 'c' }, { from: 'c', to: 'b' }],
  }, 'lab');
  assert.deepEqual(r.ok && r.value.edges, [{ from: 'root', to: 'a' }, { from: 'a', to: 'c' }]);
  // unknown select values fall back to defaults, colours are validated
  const m = sanitizeFlow({ nodes: [{ id: 'root', type: 'module', data: { color: 'red; x' } }] }, 'module');
  assert.equal(m.ok && m.value.nodes[0].data.color, '#7cb1ff');
});

test('compileModule lists labs in order with week labels', () => {
  const f = emptyFlow('module', { title: 'Web' });
  f.nodes.push({ id: 'w', type: 'divider', x: 0, y: 0, data: { title: 'Week 1' } }, { id: 'a', type: 'lab', x: 0, y: 0, data: { slug: 'lab-01' } }, { id: 'b', type: 'lab', x: 0, y: 0, data: { slug: 'Bad Slug' } });
  f.edges.push({ from: 'root', to: 'w' }, { from: 'w', to: 'a' }, { from: 'a', to: 'b' });
  const c = compileModule(f);
  assert.equal(c.meta.title, 'Web');
  assert.deepEqual(c.items, [{ kind: 'week', title: 'Week 1' }, { kind: 'lab', slug: 'lab-01' }]);
});

test('parseAssessment needs named components with whole weights that add up to 100', () => {
  const ok = parseAssessment([{ label: ' Coursework  1 ', weight: 40, detail: 'Phase 1' }, { label: 'Exam', weight: '60' }]);
  assert.deepEqual(ok, { ok: true, value: [{ label: 'Coursework 1', weight: 40, detail: 'Phase 1' }, { label: 'Exam', weight: 60, detail: '' }] });
  assert.deepEqual(parseAssessment([{ label: 'A', weight: 50 }, { label: 'B', weight: 40 }]), { ok: false, error: 'The weights add up to 90%. They must add up to 100%.' });
  assert.equal(parseAssessment([]).ok, false);
  assert.equal(parseAssessment([{ label: '', weight: 100 }]).ok, false);
  assert.equal(parseAssessment([{ label: 'A', weight: 99.5 }, { label: 'B', weight: 0.5 }]).ok, false);
  assert.equal(parseAssessment(Array.from({ length: 11 }, (_, i) => ({ label: `C${i}`, weight: 1 }))).ok, false);
});

test('module banners require safe copy and an internal optional link', () => {
  assert.deepEqual(parseModuleBanner({ title: ' Lab 03 ', message: ' Now available ', ctaLabel: 'Open lab', ctaHref: '/m/mobile-development/lab-03' }), {
    ok: true, value: { title: 'Lab 03', message: 'Now available', ctaLabel: 'Open lab', ctaHref: '/m/mobile-development/lab-03' },
  });
  assert.equal(parseModuleBanner({ title: '', message: 'Hello' }).ok, false);
  assert.equal(parseModuleBanner({ title: 'Hello', message: 'World', ctaLabel: 'Open', ctaHref: 'https://example.com' }).ok, false);
  assert.equal(parseModuleBanner({ title: 'Hello', message: 'World', ctaLabel: 'Open', ctaHref: '' }).ok, false);
});
