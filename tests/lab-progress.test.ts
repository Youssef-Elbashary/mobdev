// Lab progress: event validation, storage rules (same as supabase/lab-progress.sql) and /admin statistics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, MemoryLabBackend, validateLabEvent, type LabEvent } from '../src/lib/lab/core.ts';
import { ProgressLabBackend } from '../src/lib/lab/progress-backend.ts';
import { MemoryStore } from '../src/lib/progress/store.ts';

const base = { lab: 'lab-02', name: 'Mariam Ahmed', studentId: 'ST-001', deviceId: 'dev-aaaaaaaaaaaaaaaa' };
const ev = (extra: Record<string, unknown>) => {
  const v = validateLabEvent({ ...base, ...extra });
  if (!v.ok) throw new Error(v.error);
  return v.event;
};

test('validation: accepts start / check / hint and normalises the student key', () => {
  const start = validateLabEvent({ ...base, event: 'start' });
  assert.ok(start.ok);
  assert.equal(start.ok && start.event.studentKey, 'st-001');
  const check = validateLabEvent({ ...base, event: 'check', exercise: 'ex05', result: 'partial', score: 0.666 });
  assert.ok(check.ok && check.event.score === 0.666);
  const pass = validateLabEvent({ ...base, event: 'check', exercise: 'ex05', result: 'pass', score: 0.2 });
  assert.ok(pass.ok && pass.event.score === 1, 'a pass always scores 1');
  assert.ok(validateLabEvent({ ...base, event: 'hint', exercise: 'ex17' }).ok);
});

test('validation: rejects bad labs, events, exercises, results and students', () => {
  const bad = (extra: Record<string, unknown>) => validateLabEvent({ ...base, event: 'check', exercise: 'ex05', result: 'pass', ...extra });
  assert.equal(bad({ lab: 'lab-99' }).ok, false);
  assert.equal(bad({ event: 'delete' }).ok, false);
  assert.equal(bad({ exercise: 'ex99' }).ok, false);
  assert.equal(bad({ result: 'great' }).ok, false);
  assert.equal(bad({ name: 'x' }).ok, false);
  assert.equal(bad({ studentId: '!' }).ok, false);
  assert.equal(bad({ deviceId: 'short' }).ok, false);
  assert.equal(validateLabEvent(null).ok, false);
  const clamped = validateLabEvent({ ...base, event: 'check', exercise: 'ex05', result: 'partial', score: 7 });
  assert.ok(clamped.ok && clamped.event.score === 1);
});

test('memory store: attempts, hints, best score; solved stays solved; final challenge completes the lab', async () => {
  let t = Date.parse('2026-10-05T09:00:00Z');
  const store = new MemoryLabBackend(() => new Date(t));
  await store.record(ev({ event: 'start' }));
  t += 60_000;
  await store.record(ev({ event: 'check', exercise: 'ex05', result: 'partial', score: 0.67 }));
  await store.record(ev({ event: 'hint', exercise: 'ex05' }));
  await store.record(ev({ event: 'check', exercise: 'ex05', result: 'pass' }));
  await store.record(ev({ event: 'check', exercise: 'ex05', result: 'fail', score: 0 }));
  let { students, attempts } = await store.rows('lab-02');
  assert.equal(students.length, 1);
  assert.equal(students[0].completed_at, null);
  assert.deepEqual(
    { attempts: attempts[0].attempts, hints: attempts[0].hints, best: attempts[0].best_score, solved: !!attempts[0].solved_at },
    { attempts: 3, hints: 1, best: 1, solved: true },
  );
  t += 20 * 60_000;
  await store.record(ev({ event: 'check', exercise: 'ex17', result: 'pass' }));
  ({ students } = await store.rows('lab-02'));
  assert.equal(students[0].completed_at, new Date(t).toISOString());
});

test('memory store: same student on two devices is one row; IDs are case-insensitive', async () => {
  const store = new MemoryLabBackend();
  await store.record(ev({ event: 'start' }));
  await store.record(ev({ event: 'start', studentId: 'st-001', deviceId: 'dev-bbbbbbbbbbbbbbbb' }));
  assert.equal((await store.rows('lab-02')).students.length, 1);
});

test('rate limit counter resets after its window', async () => {
  let t = 0;
  const store = new MemoryLabBackend(() => new Date(t));
  assert.equal(await store.hit('k', 10), 1);
  assert.equal(await store.hit('k', 10), 2);
  t += 11_000;
  assert.equal(await store.hit('k', 10), 1);
});

test('progress-store adapter powers the live dashboard without a separate Supabase schema', async () => {
  let t = Date.parse('2026-10-05T09:00:00Z');
  const backend = new ProgressLabBackend(new MemoryStore(() => t));
  await backend.record(ev({ event: 'start' }));
  t += 60_000;
  await backend.record(ev({ event: 'check', exercise: 'ex05', result: 'partial', score: 0.6 }));
  await backend.record(ev({ event: 'check', exercise: 'ex05', result: 'pass' }));
  await backend.record(ev({ event: 'check', exercise: 'ex17', result: 'pass' }));

  const { students, attempts } = await backend.rows('lab-02');
  assert.equal(students.length, 1);
  assert.equal(students[0].completed_at, new Date(t).toISOString());
  assert.deepEqual(
    { attempts: attempts[0].attempts, score: attempts[0].best_score, solved: !!attempts[0].solved_at },
    { attempts: 2, score: 1, solved: true },
  );
});

test('aggregate: per-exercise attempted / solved / not solved / success rate / hardest', async () => {
  const t0 = Date.parse('2026-10-05T09:00:00Z');
  let t = t0;
  const store = new MemoryLabBackend(() => new Date(t));
  const students = [
    { name: 'Mariam Ahmed', studentId: 'ST-1' },
    { name: 'Ali Hassan', studentId: 'ST-2' },
    { name: 'Salma Youssef', studentId: 'ST-3' },
    { name: 'Omar Khaled', studentId: 'ST-4' },
  ];
  const as = (i: number, extra: Record<string, unknown>) => ev({ ...students[i], deviceId: `device-${i}-aaaaaaaaaaaa`, ...extra }) as LabEvent;
  for (let i = 0; i < 4; i++) await store.record(as(i, { event: 'start' }));
  // ex05: all 4 try, 3 solve
  for (let i = 0; i < 4; i++) await store.record(as(i, { event: 'check', exercise: 'ex05', result: i < 3 ? 'pass' : 'fail', score: i < 3 ? 1 : 0 }));
  // ex10: 3 try, 1 solves (hardest), lots of attempts
  for (let i = 0; i < 3; i++) {
    await store.record(as(i, { event: 'check', exercise: 'ex10', result: 'partial', score: 0.4 }));
    await store.record(as(i, { event: 'hint', exercise: 'ex10' }));
  }
  await store.record(as(0, { event: 'check', exercise: 'ex10', result: 'pass' }));
  // only a hint on ex13 = trying, not attempted
  await store.record(as(1, { event: 'hint', exercise: 'ex13' }));
  t += 30 * 60_000;
  await store.record(as(0, { event: 'check', exercise: 'ex17', result: 'pass' }));

  const { students: s, attempts } = await store.rows('lab-02');
  const stats = aggregate('lab-02', s, attempts, t + 60_000);

  const ex05 = stats.exercises.find((e) => e.id === 'ex05')!;
  assert.deepEqual([ex05.attempted, ex05.solved, ex05.notSolved, ex05.successRate], [4, 3, 1, 0.75]);
  const ex10 = stats.exercises.find((e) => e.id === 'ex10')!;
  assert.deepEqual([ex10.attempted, ex10.solved, ex10.successRate, ex10.hints, ex10.avgAttempts], [3, 1, 0.33, 3, 1.3]);
  const ex13 = stats.exercises.find((e) => e.id === 'ex13')!;
  assert.deepEqual([ex13.attempted, ex13.successRate, ex13.hints], [0, null, 1]);
  assert.equal(stats.hardest[0], 'ex10');
  assert.ok(!stats.hardest.includes('ex13'), 'nobody attempted ex13 yet');

  assert.equal(stats.totals.started, 4);
  assert.equal(stats.totals.completed, 1);
  assert.equal(stats.totals.active, 1, 'only Mariam was seen in the last 2 minutes');
  const mariam = stats.students[0];
  assert.equal(mariam.name, 'Mariam Ahmed', 'most solved first');
  assert.equal(mariam.solved, 3);
  assert.equal(mariam.completed, true);
  assert.equal(mariam.minutes, 30);
  assert.equal(mariam.states.ex05, 'solved');
  const ali = stats.students.find((x) => x.name === 'Ali Hassan')!;
  assert.equal(ali.states.ex10, 'trying');
  assert.equal(ali.states.ex13, 'trying');
  assert.equal(ali.states.ex01, 'new');
  assert.equal(stats.totals.avgMinutesToComplete, 30);
  assert.ok(stats.totals.avgCompletion > 0 && stats.totals.avgCompletion < 1);
});

test('aggregate: empty lab', () => {
  const stats = aggregate('lab-02', [], []);
  assert.equal(stats.totals.started, 0);
  assert.equal(stats.exercises.length, 17);
  assert.deepEqual(stats.hardest, []);
});
