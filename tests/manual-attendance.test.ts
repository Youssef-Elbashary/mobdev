import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/lib/progress/store.ts';
import { markPresent } from '../src/lib/progress/manual-attendance.ts';
import { validateStudentIdentity } from '../src/lib/progress/core.ts';

test('manual identity accepts name and ID without a browser and validates both fields', () => {
  assert.deepEqual(validateStudentIdentity({ name: '  Mariam   Ahmed ', studentId: ' AB123 ' }), {
    ok: true, value: { name: 'Mariam Ahmed', studentId: 'AB123', studentKey: 'ab123' },
  });
  assert.equal(validateStudentIdentity({ name: '', studentId: 'AB123' }).ok, false);
  assert.equal(validateStudentIdentity({ name: '<script>', studentId: 'AB123' }).ok, false);
  assert.equal(validateStudentIdentity({ name: 'Mariam Ahmed', studentId: '1' }).ok, false);
});

test('manual entry creates an unbound student in just the selected session and is repeatable', async () => {
  const store = new MemoryStore();
  const session = await store.createSession('lab-02', 'TA', 'Monday');
  const other = await store.createSession('lab-02', 'TA', 'Tuesday');
  const student = { studentKey: 'ab123', studentId: 'AB123', name: 'Mariam Ahmed' };
  const at = await store.addManualAttendance('lab-02', session.id, student);
  assert.ok(at);
  const data = await store.studentData('lab-02', student.studentKey, session.id);
  assert.equal(data.student?.name, student.name);
  assert.equal(data.student?.device_key, null);
  assert.equal(data.checkin, at);
  assert.deepEqual(data.attempts, []);
  assert.equal((await store.labData('lab-02', other.id)).students.length, 0);
  assert.equal(await store.addManualAttendance('lab-02', session.id, student), at);
  assert.equal((await store.labData('lab-02', session.id)).students.length, 1);
  assert.equal(await store.touchStudent({ ...student, deviceKey: 'student-device-123456' }), 'ok');
});

test('manual entry trusts the ID and preserves existing identity, group and device', async () => {
  const store = new MemoryStore();
  const session = await store.createSession('lab-02', 'TA', 'Monday');
  const student = { studentKey: 'ab123', studentId: 'AB123', name: 'Mariam Ahmed' };
  await store.touchStudent({ ...student, deviceKey: 'student-device-123456' });
  await store.joinSession(session.id, student.studentKey, 'Group A');
  const before = await store.labData('lab-02', session.id);
  assert.ok(await store.addManualAttendance('lab-02', session.id, { ...student, name: 'Mariam A. Ahmed' }), 'a differently typed name is still accepted');
  assert.deepEqual((await store.labData('lab-02', session.id)).students, before.students, 'the recorded name is kept');
  assert.ok(await store.addManualAttendance('lab-02', session.id, { ...student, name: 'mariam ahmed' }));
  assert.deepEqual((await store.labData('lab-02', session.id)).students, before.students);
  assert.equal(await store.addManualAttendance('lab-03', session.id, { ...student, studentKey: 'new123' }), null);
  assert.equal(await store.addManualAttendance('lab-02', 'missing', { ...student, studentKey: 'new123' }), null);
  assert.equal((await store.studentData('lab-02', 'new123')).student, null);
});

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
