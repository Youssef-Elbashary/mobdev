// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCheckIn,
  signSession,
  verifySession,
  checkPassword,
  sessionSecret,
  findRedisEnv,
  findSupabaseEnv,
  classifyDuplicate,
  AttendanceStore,
  MemoryRedis,
} from '../src/lib/attendance/core.ts';

const DEVICE_A = 'dev-aaaaaaaaaaaaaaaaaaaa';
const DEVICE_B = 'dev-bbbbbbbbbbbbbbbbbbbb';

/* ---------------- validation ---------------- */

test('valid check-in is accepted and normalised', () => {
  const r = validateCheckIn({ name: '  Mariam   Ahmed ', studentId: ' 236541 ', deviceId: DEVICE_A });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.name, 'Mariam Ahmed');
    assert.equal(r.studentId, '236541');
    assert.equal(r.deviceId, DEVICE_A);
  }
});

test('Arabic names are accepted', () => {
  const r = validateCheckIn({ name: 'مريم أحمد', studentId: '236541', deviceId: DEVICE_A });
  assert.equal(r.ok, true);
});

test('empty or one-letter names are rejected', () => {
  for (const name of ['', '   ', 'M']) {
    const r = validateCheckIn({ name, studentId: '236541', deviceId: DEVICE_A });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.name);
  }
});

test('names with digits or markup are rejected', () => {
  for (const name of ['<script>alert(1)</script>', 'Mariam 123']) {
    const r = validateCheckIn({ name, studentId: '236541', deviceId: DEVICE_A });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.name);
  }
});

test('malformed student IDs are rejected', () => {
  for (const studentId of ['', '12', '12 34', 'abc$1', 'x'.repeat(21)]) {
    const r = validateCheckIn({ name: 'Mariam Ahmed', studentId, deviceId: DEVICE_A });
    assert.equal(r.ok, false, `expected "${studentId}" to be rejected`);
    if (!r.ok) assert.ok(r.errors.studentId);
  }
});

test('missing or malformed device id is rejected', () => {
  for (const deviceId of [undefined, '', 'short', 'has spaces in it 123456']) {
    const r = validateCheckIn({ name: 'Mariam Ahmed', studentId: '236541', deviceId });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.deviceId);
  }
});

test('non-object input is rejected without throwing', () => {
  const r = validateCheckIn(null);
  assert.equal(r.ok, false);
});

/* ---------------- admin sessions ---------------- */

test('a signed session verifies with the same secret', () => {
  const token = signSession('secret-1', 1_000_000);
  assert.equal(verifySession(token, 'secret-1', 1_000_001), true);
});

test('a tampered session is rejected', () => {
  const token = signSession('secret-1', 1_000_000);
  const [v, exp, mac] = token.split('.');
  const forged = `${v}.${Number(exp) + 999_999_999}.${mac}`;
  assert.equal(verifySession(forged, 'secret-1', 1_000_001), false);
  assert.equal(verifySession('garbage', 'secret-1', 1_000_001), false);
  assert.equal(verifySession(undefined, 'secret-1', 1_000_001), false);
});

test('an expired session is rejected', () => {
  const token = signSession('secret-1', 1_000_000, 1000);
  assert.equal(verifySession(token, 'secret-1', 1_000_000 + 1001), false);
});

test('changing the secret (password) invalidates old sessions', () => {
  const token = signSession('secret-1', 1_000_000);
  assert.equal(verifySession(token, 'secret-2', 1_000_001), false);
});

/* ---------------- password check ---------------- */

test('checkPassword accepts only the exact configured password', () => {
  assert.equal(checkPassword('open sesame', 'open sesame'), true);
  assert.equal(checkPassword('open sesam', 'open sesame'), false);
  assert.equal(checkPassword('', 'open sesame'), false);
});

test('checkPassword is always false when no password is configured', () => {
  assert.equal(checkPassword('', ''), false);
  assert.equal(checkPassword('anything', undefined), false);
});

test('sessionSecret depends on the password', () => {
  assert.equal(sessionSecret('pw-1'), sessionSecret('pw-1'));
  assert.notEqual(sessionSecret('pw-1'), sessionSecret('pw-2'));
  assert.ok(sessionSecret('pw-1').length >= 32);
});

/* ---------------- store: once per device, once per ID ---------------- */

function newStore() {
  return new AttendanceStore(new MemoryRedis(), 'test');
}

test('first check-in is stored as entry #1', async () => {
  const store = newStore();
  const r = await store.checkIn({ deviceId: DEVICE_A, name: 'Mariam Ahmed', studentId: '236541', at: '2026-09-30T10:00:00.000Z' });
  assert.equal(r.status, 'ok');
  if (r.status === 'ok') {
    assert.deepEqual(r.entry, { n: 1, name: 'Mariam Ahmed', id: '236541', at: '2026-09-30T10:00:00.000Z' });
  }
  assert.equal(await store.count(), 1);
});

test('the same device cannot check in twice and gets its first entry back', async () => {
  const store = newStore();
  await store.checkIn({ deviceId: DEVICE_A, name: 'Mariam Ahmed', studentId: '236541', at: 't1' });
  const r = await store.checkIn({ deviceId: DEVICE_A, name: 'Someone Else', studentId: '999999', at: 't2' });
  assert.equal(r.status, 'device');
  if (r.status === 'device') assert.equal(r.entry.name, 'Mariam Ahmed');
  assert.equal(await store.count(), 1);
});

test('the same student ID cannot appear twice, even from another device or in other case', async () => {
  const store = newStore();
  await store.checkIn({ deviceId: DEVICE_A, name: 'Mariam Ahmed', studentId: 'AB123', at: 't1' });
  const r = await store.checkIn({ deviceId: DEVICE_B, name: 'Mariam A', studentId: 'ab123', at: 't2' });
  assert.equal(r.status, 'id');
  assert.equal(await store.count(), 1);
});

test('a rejected duplicate ID does not lock the new device', async () => {
  const store = newStore();
  await store.checkIn({ deviceId: DEVICE_A, name: 'Mariam Ahmed', studentId: '236541', at: 't1' });
  await store.checkIn({ deviceId: DEVICE_B, name: 'Typo Person', studentId: '236541', at: 't2' });
  const r = await store.checkIn({ deviceId: DEVICE_B, name: 'Omar Hassan', studentId: '236542', at: 't3' });
  assert.equal(r.status, 'ok');
  assert.equal(await store.count(), 2);
});

test('list(from) returns only entries after the given number, in order', async () => {
  const store = newStore();
  await store.checkIn({ deviceId: DEVICE_A, name: 'Mariam Ahmed', studentId: '236541', at: 't1' });
  await store.checkIn({ deviceId: DEVICE_B, name: 'Omar Hassan', studentId: '236542', at: 't2' });
  assert.deepEqual((await store.list(0)).map((e) => e.n), [1, 2]);
  assert.deepEqual((await store.list(1)).map((e) => e.name), ['Omar Hassan']);
  assert.deepEqual(await store.list(2), []);
});

test('hit() counts attempts per key (for login rate limiting)', async () => {
  const store = newStore();
  assert.equal(await store.hit('login:1.2.3.4', 600), 1);
  assert.equal(await store.hit('login:1.2.3.4', 600), 2);
  assert.equal(await store.hit('login:5.6.7.8', 600), 1);
});

test('check-ins stop at the size limit and the refused device is not locked', async () => {
  const store = new AttendanceStore(new MemoryRedis(), 'test', { maxEntries: 1 });
  await store.checkIn({ deviceId: DEVICE_A, name: 'Mariam Ahmed', studentId: '236541', at: 't1' });
  const r = await store.checkIn({ deviceId: DEVICE_B, name: 'Omar Hassan', studentId: '236542', at: 't2' });
  assert.equal(r.status, 'full');
  assert.equal(await store.count(), 1);
});

/* ---------------- database settings from Vercel ---------------- */

test('findRedisEnv reads the standard Upstash / Vercel names', () => {
  assert.deepEqual(findRedisEnv({ KV_REST_API_URL: 'https://a', KV_REST_API_TOKEN: 't' }), { url: 'https://a', token: 't' });
  assert.deepEqual(findRedisEnv({ UPSTASH_REDIS_REST_URL: 'https://b', UPSTASH_REDIS_REST_TOKEN: 'u' }), { url: 'https://b', token: 'u' });
});

test('findRedisEnv also finds names with a custom prefix', () => {
  assert.deepEqual(findRedisEnv({ STORAGE_KV_REST_API_URL: 'https://c', STORAGE_KV_REST_API_TOKEN: 'v' }), { url: 'https://c', token: 'v' });
});

test('findRedisEnv ignores the read-only token and returns null when incomplete', () => {
  assert.equal(findRedisEnv({ KV_REST_API_URL: 'https://a', KV_REST_API_READ_ONLY_TOKEN: 'ro' }), null);
  assert.equal(findRedisEnv({}), null);
});

/* ---------------- Supabase ---------------- */

test('findSupabaseEnv reads URL + secret key (new and legacy names)', () => {
  assert.deepEqual(findSupabaseEnv({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_1' }), { url: 'https://x.supabase.co', key: 'sb_secret_1' });
  assert.deepEqual(findSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://y.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'eyJ.legacy' }), { url: 'https://y.supabase.co', key: 'eyJ.legacy' });
});

test('findSupabaseEnv never uses the public (publishable/anon) key', () => {
  assert.equal(findSupabaseEnv({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1', SUPABASE_ANON_KEY: 'anon' }), null);
  assert.equal(findSupabaseEnv({}), null);
});

test('classifyDuplicate tells a reused device from a reused student ID', () => {
  assert.equal(classifyDuplicate({ code: '23505', details: 'Key (device_id)=(dev-aaaa) already exists.' }), 'device');
  assert.equal(classifyDuplicate({ code: '23505', message: 'duplicate key value violates unique constraint "attendance_dev_device_id_key"' }), 'device');
  assert.equal(classifyDuplicate({ code: '23505', details: 'Key (student_key)=(236541) already exists.' }), 'id');
  assert.equal(classifyDuplicate({ code: '23505', message: 'duplicate key value violates unique constraint "attendance_student_key_key"' }), 'id');
});

test('classifyDuplicate ignores errors that are not duplicates', () => {
  assert.equal(classifyDuplicate({ code: '42P01', message: 'relation "attendance" does not exist' }), null);
  assert.equal(classifyDuplicate(null), null);
});
