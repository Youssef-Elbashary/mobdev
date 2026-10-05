// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateIdentity,
  validateAttempt,
  validateTask,
  validateSubmission,
  decideLock,
  labStructure,
  scoreStudent,
  exerciseStats,
  toCsv,
  type LabStructure,
  type Best,
} from '../src/lib/progress/core.ts';

const DEVICE = 'dev-aaaaaaaaaaaaaaaaaaaa';
const me = { name: 'Mariam Ahmed', studentId: '236541', deviceKey: DEVICE };

const LAB: LabStructure = {
  lab: 'lab-02',
  title: 'Lab 02',
  tasks: [{ n: '3.2', title: 'useState' }, { n: '4.2', title: 'Add' }],
  exercises: [
    { id: 'e05-counter', task: '3.2', title: 'Counter', checks: 5 },
    { id: 'e10-todo-add', task: '4.2', title: 'To-Do', checks: 4 },
  ],
  hasSubmission: true,
};

/* ---------------- validation ---------------- */

test('identity: valid input is normalised, student key is lower-case', () => {
  const r = validateIdentity({ name: '  Mariam   Ahmed ', studentId: ' ab-12C ', deviceKey: DEVICE });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.name, 'Mariam Ahmed');
    assert.equal(r.value.studentId, 'ab-12C');
    assert.equal(r.value.studentKey, 'ab-12c');
  }
});

test('identity: bad name, id and device are rejected with messages', () => {
  const r = validateIdentity({ name: 'M1', studentId: '!!', deviceKey: 'x' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ['deviceKey', 'name', 'studentId']);
  assert.equal(validateIdentity(null).ok, false);
});

test('attempt: valid, and every rule enforced', () => {
  const ok = validateAttempt({ ...me, lab: 'lab-02', exercise: 'e05-counter', passed: 3, total: 5, code: '{}' }, [LAB]);
  assert.equal(ok.ok, true);
  const bad = (o: object) => validateAttempt({ ...me, lab: 'lab-02', exercise: 'e05-counter', passed: 3, total: 5, code: '{}', ...o }, [LAB]).ok;
  assert.equal(bad({ lab: 'lab-99' }), false);
  assert.equal(bad({ exercise: 'demo-jsx' }), false);
  assert.equal(bad({ passed: 6 }), false);
  assert.equal(bad({ passed: -1 }), false);
  assert.equal(bad({ total: 51, passed: 0 }), false);
  assert.equal(bad({ passed: 1.5 }), false);
  assert.equal(bad({ code: 'x'.repeat(20_001) }), false);
  assert.equal(bad({ name: '' }), false);
});

test('task: only real task numbers', () => {
  assert.equal(validateTask({ ...me, lab: 'lab-02', task: '3.2', done: true }, [LAB]).ok, true);
  assert.equal(validateTask({ ...me, lab: 'lab-02', task: '9.9', done: true }, [LAB]).ok, false);
  assert.equal(validateTask({ ...me, lab: 'lab-02', task: '3.2', done: 'yes' }, [LAB]).ok, false);
});

test('submission: only GitHub repo links, only labs that ask for one', () => {
  const v = (url: string, labs = [LAB]) => validateSubmission({ ...me, lab: 'lab-02', url }, labs).ok;
  assert.equal(v('https://github.com/mariam/movies-app'), true);
  assert.equal(v('https://github.com/mariam/movies-app/'), true);
  assert.equal(v('http://github.com/mariam/movies-app'), false);
  assert.equal(v('https://gitlab.com/mariam/movies-app'), false);
  assert.equal(v('https://github.com/mariam'), false);
  assert.equal(v('https://github.com/mariam/movies-app', [{ ...LAB, hasSubmission: false }]), false);
});

/* ---------------- device lock ---------------- */

test('decideLock: create, same device, unlocked, other device', () => {
  assert.equal(decideLock(null, DEVICE), 'create');
  assert.equal(decideLock({ device_key: DEVICE }, DEVICE), 'ok');
  assert.equal(decideLock({ device_key: null }, DEVICE), 'relock');
  assert.equal(decideLock({ device_key: 'dev-bbbbbbbbbbbbbbbbbbbb' }, DEVICE), 'conflict');
});

/* ---------------- lab structure ---------------- */

test('labStructure reads tasks and exercises (not demos) from the real Lab 02', () => {
  const body = fs.readFileSync(new URL('../src/content/labs/lab-02.mdx', import.meta.url), 'utf8');
  const s = labStructure('lab-02', 'Lab 02', body, (id) => ({ title: id, checks: 3 }));
  assert.equal(s.tasks.length, 26);
  assert.equal(s.exercises.length, 11);
  assert.equal(s.exercises.find((e) => e.id === 'e05-counter')?.task, '3.2');
  assert.equal(s.exercises.some((e) => e.id.startsWith('demo-')), false);
  assert.equal(s.exercises.every((e) => e.checks === 3), true);
});

test('labStructure: unknown playgrounds are skipped, RepoSubmit is detected', () => {
  const body = `<Task n="1.1" title="A">\n<Playground ex="known" />\n<Playground ex="gone" />\n</Task>\n<Task n="1.2" title="B">\n<RepoSubmit lab="x" />\n</Task>`;
  const s = labStructure('x', 'X', body, (id) => (id === 'known' ? { title: 'Known', checks: 2 } : null));
  assert.deepEqual(s.exercises, [{ id: 'known', task: '1.1', title: 'Known', checks: 2 }]);
  assert.equal(s.hasSubmission, true);
  assert.equal(labStructure('x', 'X', '<Task n="1.1" title="A"></Task>', () => null).hasSubmission, false);
});

/* ---------------- scoring ---------------- */

const best = (exercise: string, passed: number, total: number, attempts = 1): Best => ({
  exercise, passed, total, attempts, firstAt: '2026-10-05T10:00:00Z', solvedAt: passed === total ? '2026-10-05T10:05:00Z' : null,
});

test('scoreStudent: 0, 100 and partial credit', () => {
  assert.deepEqual(scoreStudent(LAB, [], 0, false), { percent: 0, solved: 0 });
  assert.deepEqual(scoreStudent(LAB, [best('e05-counter', 5, 5), best('e10-todo-add', 4, 4)], 2, true), { percent: 100, solved: 2 });
  // half the checks on one of two exercises: 70 × (0.5 / 2) = 17.5 → 18
  assert.equal(scoreStudent(LAB, [best('e05-counter', 2.5, 5)], 0, false).percent, 18);
  // tasks only: 20 × 1/2 = 10
  assert.equal(scoreStudent(LAB, [], 1, false).percent, 10);
});

test('scoreStudent: weights without a submission, and labs without exercises', () => {
  const noSub = { ...LAB, hasSubmission: false };
  assert.equal(scoreStudent(noSub, [best('e05-counter', 5, 5), best('e10-todo-add', 4, 4)], 0, false).percent, 75);
  const noEx = { ...LAB, exercises: [], hasSubmission: false };
  assert.equal(scoreStudent(noEx, [], 1, false).percent, 50);
});

test('exerciseStats: solved %, attempts and median time', () => {
  const stats = exerciseStats(LAB, [
    [best('e05-counter', 5, 5, 3)],
    [best('e05-counter', 2, 5, 1), best('e10-todo-add', 4, 4, 2)],
    [],
  ]);
  const e05 = stats.find((s) => s.id === 'e05-counter')!;
  assert.equal(e05.solvedPct, 33); // 1 of 3 students
  assert.equal(e05.avgAttempts, 2); // (3 + 1) / 2 who tried
  assert.equal(e05.medianSolveMs, 5 * 60_000);
  assert.equal(stats.find((s) => s.id === 'e10-todo-add')!.solvedPct, 33);
});

test('toCsv quotes commas, quotes and newlines', () => {
  assert.equal(toCsv([['a', 'b,c'], ['say "hi"', 'x\ny'], [1, 2]]), 'a,"b,c"\r\n"say ""hi""","x\ny"\r\n1,2');
});
