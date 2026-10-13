import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/lib/progress/store.ts';
import { markPresent } from '../src/lib/progress/manual-attendance.ts';

test('staff can mark a student present in an ended session without changing progress or identity', async () => {
  let now = Date.parse('2026-10-13T10:00:00Z');
  const store = new MemoryStore(() => now);
  const first = await store.openSession('lab-02', 60);
  const parallel = await store.openSession('lab-02', 60);
  await store.touchStudent({ studentKey: '123', studentId: '123', name: 'Test Student', deviceKey: 'device-123' });
  await store.joinSession(first.id, '123', 'A');
  await store.joinSession(parallel.id, '123', 'B');
  await store.closeSession('lab-02', first.id);
  const before = await store.studentData('lab-02', '123', first.id);
  now += 120_000;
  const at = await markPresent(store, 'lab-02', first.id, '123');
  assert.equal(at, new Date(now).toISOString());
  assert.deepEqual(await store.studentData('lab-02', '123', first.id), { ...before, checkin: at });
  assert.equal((await store.studentData('lab-02', '123', parallel.id)).checkin, null);
  now += 120_000;
  assert.equal(await markPresent(store, 'lab-02', first.id, '123'), at);
  assert.equal((await store.labData('lab-02', first.id)).checkins.length, 1);
});

test('manual attendance rejects missing sessions, other labs and students outside the session', async () => {
  const store = new MemoryStore();
  const session = await store.openSession('lab-02', 60);
  await store.touchStudent({ studentKey: '123', studentId: '123', name: 'Test Student', deviceKey: 'device-123' });
  assert.equal(await markPresent(store, 'lab-02', session.id, '123'), null);
  await store.joinSession(session.id, '123', 'A');
  assert.equal(await markPresent(store, 'lab-03', session.id, '123'), null);
  assert.equal(await markPresent(store, 'lab-02', 'missing', '123'), null);
  assert.equal(await markPresent(store, 'lab-02', session.id, 'unknown'), null);
  assert.deepEqual((await store.labData('lab-02', session.id)).checkins, []);
});
