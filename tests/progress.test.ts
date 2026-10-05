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
  assert.equal(s.tasks.length, 10);
  assert.equal(s.exercises.length, 17);
  assert.equal(s.exercises.find((e) => e.id === 'ex05')?.task, '3');
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

/* ---------------- memory store ---------------- */

import { MemoryStore } from '../src/lib/progress/store.ts';

const ident = (key: string, device = DEVICE, name = 'Mariam Ahmed') => ({ name, studentId: key.toUpperCase(), studentKey: key, deviceKey: device });

test('store: student IDs and devices are one-to-one until the admin unlocks them', async () => {
  const s = new MemoryStore();
  assert.equal(await s.touchStudent(ident('236541')), 'ok');
  assert.equal(await s.touchStudent(ident('236541', DEVICE, 'Mariam A. Ahmed')), 'conflict', 'name cannot be changed after identity is locked');
  assert.equal((await s.studentData('lab-02', '236541')).student?.name, 'Mariam Ahmed');
  assert.equal(await s.touchStudent(ident('999999')), 'conflict', 'one browser cannot claim a second student ID');
  assert.equal(await s.touchStudent(ident('236541', 'dev-bbbbbbbbbbbbbbbbbbbb')), 'conflict');
  await s.unlock('236541');
  assert.equal(await s.touchStudent(ident('236541', 'dev-bbbbbbbbbbbbbbbbbbbb')), 'ok');
  assert.equal(await s.touchStudent(ident('236541')), 'conflict');
  assert.equal(await s.touchStudent(ident('999999')), 'ok', 'the released original device may be assigned again');
});

test('store: attempts roll up into best score, attempts and solve time', async () => {
  let t = Date.parse('2026-10-05T10:00:00Z');
  const s = new MemoryStore(() => t);
  await s.touchStudent(ident('a1'));
  const at = (exercise: string, passed: number, total = 5) => s.addAttempt({ studentKey: 'a1', lab: 'lab-02', exercise, passed, total, code: `{"App.tsx":"${passed}"}` });
  await at('e05-counter', 2);
  t += 60_000;
  await at('e05-counter', 5);
  t += 60_000;
  await at('e05-counter', 3); // a worse later try does not lower the best
  await at('e10-todo-add', 1, 4);
  const d = await s.labData('lab-02');
  assert.equal(d.students.length, 1);
  const e05 = d.best.find((b) => b.exercise === 'e05-counter')!;
  assert.deepEqual([e05.passed, e05.total, e05.attempts], [5, 5, 3]);
  assert.equal(Date.parse(e05.solvedAt!) - Date.parse(e05.firstAt), 60_000);
  assert.equal(d.best.find((b) => b.exercise === 'e10-todo-add')!.solvedAt, null);
  const detail = await s.studentData('lab-02', 'a1');
  assert.equal(detail.attempts.length, 4);
  assert.equal(detail.attempts[0].exercise, 'e10-todo-add'); // newest first
});

test('store: tasks toggle, submissions can be reviewed, other labs are separate', async () => {
  const s = new MemoryStore();
  await s.touchStudent(ident('a1'));
  await s.setTask({ studentKey: 'a1', lab: 'lab-02', task: '3.2', done: true });
  await s.setTask({ studentKey: 'a1', lab: 'lab-02', task: '4.2', done: true });
  await s.setTask({ studentKey: 'a1', lab: 'lab-02', task: '4.2', done: false });
  await s.setSubmission({ studentKey: 'a1', lab: 'lab-02', url: 'https://github.com/a/b' });
  await s.review('a1', 'lab-02', true, 'Nice work');
  const d = await s.labData('lab-02');
  assert.deepEqual(d.tasks, [{ student_key: 'a1', done: 1 }]);
  assert.equal(d.submissions[0].reviewed, true);
  assert.equal(d.submissions[0].note, 'Nice work');
  assert.equal((await s.labData('lab-03')).students.length, 0);
});

test('store: hit() counts per key inside a time window', async () => {
  let t = 0;
  const s = new MemoryStore(() => t);
  assert.equal(await s.hit('k', 600), 1);
  assert.equal(await s.hit('k', 600), 2);
  t += 601_000;
  assert.equal(await s.hit('k', 600), 1);
});

/* ---------------- per-lab attendance + reading ---------------- */

import { attendanceEligibility, validateCheckin, validateViews, sessionState } from '../src/lib/progress/core.ts';

test('check-in and views validation', () => {
  assert.equal(validateCheckin({ ...me, lab: 'lab-02' }, [LAB]).ok, true);
  assert.equal(validateCheckin({ ...me, lab: 'nope' }, [LAB]).ok, false);
  const v = (o: object) => validateViews({ ...me, lab: 'lab-02', seen: ['3.2'], activeSec: 30, ...o }, [LAB]);
  assert.equal(v({}).ok, true);
  assert.equal(v({ seen: ['9.9'] }).ok, false);
  assert.equal(v({ seen: 'x' }).ok, false);
  assert.equal(v({ activeSec: 901 }).ok, false);
  assert.equal(v({ activeSec: -1 }).ok, false);
  assert.equal(v({ activeSec: 1.5 }).ok, false);
  const ok = v({ seen: ['3.2', '3.2', '4.2'] });
  assert.ok(ok.ok && ok.value.seen.length === 2); // de-duplicated
});

test('sessionState: none, open with and without a limit, expired', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  assert.deepEqual(sessionState(null, now), { open: false, closesAt: null });
  assert.deepEqual(sessionState({ opens_at: '2026-10-05T11:50:00Z', closes_at: null }, now), { open: true, closesAt: null });
  assert.deepEqual(sessionState({ opens_at: '2026-10-05T11:50:00Z', closes_at: '2026-10-05T12:20:00.000Z' }, now), { open: true, closesAt: '2026-10-05T12:20:00.000Z' });
  assert.equal(sessionState({ opens_at: '2026-10-05T11:00:00Z', closes_at: '2026-10-05T11:30:00Z' }, now).open, false);
});

test('attendance eligibility requires the original identity, device and meaningful participation', () => {
  const student = { name: 'Mariam Ahmed', device_key: DEVICE };
  const check = (change: object = {}) => attendanceEligibility({ student, name: 'Mariam Ahmed', deviceKey: DEVICE, activeSec: 300, seen: 3, ...change });
  assert.deepEqual(check(), { ok: true });
  assert.deepEqual(check({ student: null }), { ok: false, reason: 'identity' });
  assert.deepEqual(check({ deviceKey: 'dev-bbbbbbbbbbbbbbbbbbbb' }), { ok: false, reason: 'identity' });
  assert.deepEqual(check({ name: 'Another Student' }), { ok: false, reason: 'identity' });
  assert.deepEqual(check({ activeSec: 299 }), { ok: false, reason: 'participation' });
  assert.deepEqual(check({ seen: 2 }), { ok: false, reason: 'participation' });
});

test('store: sessions, idempotent check-in, views merge, and they show in labData', async () => {
  let t = Date.parse('2026-10-05T12:00:00Z');
  const s = new MemoryStore(() => t);
  assert.equal(sessionState(await s.getSession('lab-02'), t).open, false);
  await s.openSession('lab-02', 30);
  const sess = await s.getSession('lab-02');
  assert.equal(sessionState(sess, t).open, true);
  assert.equal(Date.parse(sess!.closes_at!) - t, 30 * 60_000);
  await s.touchStudent(ident('c1'));
  const first = await s.checkIn('c1', 'lab-02');
  t += 60_000;
  assert.equal(await s.checkIn('c1', 'lab-02'), first); // first time wins
  await s.addViews('c1', 'lab-02', ['1.1', '1.2'], 40);
  await s.addViews('c1', 'lab-02', ['1.2', '2.1'], 20);
  const d = await s.labData('lab-02');
  assert.equal(d.students.length, 1);
  assert.deepEqual(d.checkins, [{ student_key: 'c1', at: first }]);
  assert.deepEqual(d.views.map((v) => [v.student_key, [...v.seen].sort(), v.active_sec]), [['c1', ['1.1', '1.2', '2.1'], 60]]);
  const detail = await s.studentData('lab-02', 'c1');
  assert.equal(detail.checkin, first);
  assert.equal(detail.views?.active_sec, 60);
  await s.closeSession('lab-02');
  assert.equal(sessionState(await s.getSession('lab-02'), t).open, false);
  await s.openSession('lab-02', null);
  assert.deepEqual(sessionState(await s.getSession('lab-02'), t), { open: true, closesAt: null });
});
