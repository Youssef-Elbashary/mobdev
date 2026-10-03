/**
 * ATTENDANCE — core logic.
 * Pure TypeScript with no framework imports, so it runs in Astro, on Vercel and
 * directly under `node --test` (see tests/attendance.test.ts).
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/* ---------------------------------------------------------------- types */

export type Entry = { n: number; name: string; id: string; at: string };
export type CheckInInput = { name: string; studentId: string; deviceId: string };
export type Validation =
  | ({ ok: true } & CheckInInput)
  | { ok: false; errors: Partial<Record<keyof CheckInInput, string>> };
export type CheckInResult =
  | { status: 'ok'; entry: Entry }
  | { status: 'device'; entry?: Entry }
  | { status: 'id' }
  | { status: 'full' };

/* ----------------------------------------------------------- validation */

// letters (any language) + spaces, apostrophes, dots and hyphens; starts and ends with a letter (or dot)
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*[\p{L}\p{M}.]$/u;
const ID_RE = /^[A-Za-z0-9-]{3,20}$/;
const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function validateCheckIn(input: unknown): Validation {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const name = String(o.name ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const studentId = String(o.studentId ?? '').trim();
  const deviceId = String(o.deviceId ?? '').trim();

  const errors: Partial<Record<keyof CheckInInput, string>> = {};
  if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) errors.name = 'Please type your full name (letters only).';
  if (!ID_RE.test(studentId)) errors.studentId = 'Your student ID should be 3–20 letters or numbers.';
  if (!DEVICE_RE.test(deviceId)) errors.deviceId = 'This device could not be identified. Refresh the page and try again.';

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, name, studentId, deviceId };
}

/* ------------------------------------------------------ admin sessions */

const HOUR = 3_600_000;
const mac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('base64url');

/** Compares two strings in constant time (hashing first makes the lengths equal). */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

/** The cookie-signing secret is derived from the admin password, so changing it logs everyone out. */
export function sessionSecret(password: string): string {
  return createHash('sha256').update(`attendance-admin-session:${password}`).digest('hex');
}

export function signSession(secret: string, now = Date.now(), ttlMs = 12 * HOUR): string {
  const exp = now + ttlMs;
  return `v1.${exp}.${mac(secret, `v1.${exp}`)}`;
}

export function verifySession(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp <= now) return false;
  return safeEqual(parts[2], mac(secret, `v1.${parts[1]}`));
}

export function checkPassword(input: string | undefined, configured: string | undefined): boolean {
  if (!configured) return false;
  return safeEqual(String(input ?? ''), configured);
}

/* ------------------------------------------------- database settings */

/**
 * Finds the Upstash REST URL + token among environment variables.
 * Accepts the standard names and names with a custom prefix (e.g. STORAGE_KV_REST_API_URL).
 */
export function findRedisEnv(env: Record<string, string | undefined>): { url: string; token: string } | null {
  const pick = (names: string[]) => {
    for (const n of names) if (env[n]) return env[n];
    for (const [k, v] of Object.entries(env)) if (v && names.some((n) => k.endsWith(`_${n}`))) return v;
    return undefined;
  };
  const url = pick(['UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL']);
  const token = pick(['UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN']);
  return url && token ? { url, token } : null;
}

/**
 * Finds the Supabase project URL + server-side secret key.
 * Only the secret (or legacy service_role) key is accepted — never the public publishable/anon key.
 */
export function findSupabaseEnv(env: Record<string, string | undefined>): { url: string; key: string } | null {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

/** Postgres unique-violation (23505) → which rule was broken: same device, or same student ID. */
export function classifyDuplicate(err: { code?: string; details?: string; message?: string } | null | undefined): 'device' | 'id' | null {
  if (!err || err.code !== '23505') return null;
  const text = `${err.details ?? ''} ${err.message ?? ''}`;
  if (/device_id/.test(text)) return 'device';
  if (/student_key/.test(text)) return 'id';
  return null;
}

/* ---------------------------------------------------------------- store */

/** What every attendance backend (Redis or Supabase) provides. */
export interface AttendanceBackend {
  checkIn(input: CheckInInput & { at: string }): Promise<CheckInResult>;
  /** Entries with number greater than `from` (0 = everything), oldest first. Numbers only ever grow (may skip). */
  list(from?: number): Promise<Entry[]>;
  count(): Promise<number>;
  hit(key: string, windowSec: number): Promise<number>;
}

/** The few Redis commands we use (matches @upstash/redis with automaticDeserialization: false). */
export interface RedisLike {
  hsetnx(key: string, field: string, value: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  hset(key: string, kv: Record<string, string>): Promise<number>;
  rpush(key: string, ...values: string[]): Promise<number>;
  llen(key: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

const PENDING = '…';

/**
 * One attendance list that never resets.
 *  <prefix>:list     every check-in, in order (JSON strings)
 *  <prefix>:devices  deviceId  → entry JSON   (once per device)
 *  <prefix>:ids      studentId → entry number (once per student ID, case-insensitive)
 * HSETNX makes both "first one wins" checks atomic, even with a whole class submitting at once.
 */
export class AttendanceStore implements AttendanceBackend {
  #r: RedisLike;
  #p: string;
  #max: number;

  constructor(redis: RedisLike, prefix: string, opts: { maxEntries?: number } = {}) {
    this.#r = redis;
    this.#p = prefix;
    this.#max = opts.maxEntries ?? 5000;
  }

  #k(name: string) {
    return `${this.#p}:${name}`;
  }

  async checkIn(input: CheckInInput & { at: string }): Promise<CheckInResult> {
    const { deviceId, name, studentId, at } = input;
    const devices = this.#k('devices');
    const ids = this.#k('ids');
    const idKey = studentId.toLowerCase();

    if (!(await this.#r.hsetnx(devices, deviceId, PENDING))) {
      const prev = await this.#r.hget(devices, deviceId);
      return prev && prev !== PENDING ? { status: 'device', entry: JSON.parse(prev) as Entry } : { status: 'device' };
    }
    if (!(await this.#r.hsetnx(ids, idKey, PENDING))) {
      await this.#r.hdel(devices, deviceId);
      return { status: 'id' };
    }
    if ((await this.#r.llen(this.#k('list'))) >= this.#max) {
      await this.#r.hdel(devices, deviceId);
      await this.#r.hdel(ids, idKey);
      return { status: 'full' };
    }

    const n = await this.#r.rpush(this.#k('list'), JSON.stringify({ name, id: studentId, at }));
    const entry: Entry = { n, name, id: studentId, at };
    await this.#r.hset(devices, { [deviceId]: JSON.stringify(entry) });
    await this.#r.hset(ids, { [idKey]: String(n) });
    return { status: 'ok', entry };
  }

  /** Entries with number greater than `from` (0 = everything), oldest first. */
  async list(from = 0): Promise<Entry[]> {
    const rows = await this.#r.lrange(this.#k('list'), from, -1);
    return rows.map((raw, i) => {
      const d = JSON.parse(raw) as { name: string; id: string; at: string };
      return { n: from + i + 1, name: d.name, id: d.id, at: d.at };
    });
  }

  count(): Promise<number> {
    return this.#r.llen(this.#k('list'));
  }

  /** Counts hits on a key inside a time window (login rate limiting). */
  async hit(key: string, windowSec: number): Promise<number> {
    const k = this.#k(`hit:${key}`);
    const n = await this.#r.incr(k);
    if (n === 1) await this.#r.expire(k, windowSec);
    return n;
  }
}

/* ------------------------------------------------ in-memory Redis (dev) */

/** A tiny in-memory stand-in for Redis, used on a laptop without a database and in tests. */
export class MemoryRedis implements RedisLike {
  #hashes = new Map<string, Map<string, string>>();
  #lists = new Map<string, string[]>();
  #counters = new Map<string, { n: number; until: number }>();

  #hash(key: string) {
    if (!this.#hashes.has(key)) this.#hashes.set(key, new Map());
    return this.#hashes.get(key)!;
  }
  #list(key: string) {
    if (!this.#lists.has(key)) this.#lists.set(key, []);
    return this.#lists.get(key)!;
  }

  async hsetnx(key: string, field: string, value: string) {
    const h = this.#hash(key);
    if (h.has(field)) return 0;
    h.set(field, value);
    return 1;
  }
  async hget(key: string, field: string) {
    return this.#hash(key).get(field) ?? null;
  }
  async hdel(key: string, ...fields: string[]) {
    const h = this.#hash(key);
    let n = 0;
    for (const f of fields) if (h.delete(f)) n++;
    return n;
  }
  async hset(key: string, kv: Record<string, string>) {
    const h = this.#hash(key);
    for (const [f, v] of Object.entries(kv)) h.set(f, v);
    return Object.keys(kv).length;
  }
  async rpush(key: string, ...values: string[]) {
    const l = this.#list(key);
    l.push(...values);
    return l.length;
  }
  async llen(key: string) {
    return this.#list(key).length;
  }
  async lrange(key: string, start: number, stop: number) {
    const l = this.#list(key);
    return l.slice(start, stop === -1 ? undefined : stop + 1);
  }
  async incr(key: string) {
    const now = Date.now();
    const c = this.#counters.get(key);
    const next = c && c.until > now ? { n: c.n + 1, until: c.until } : { n: 1, until: Infinity };
    this.#counters.set(key, next);
    return next.n;
  }
  async expire(key: string, seconds: number) {
    const c = this.#counters.get(key);
    if (!c) return 0;
    c.until = Date.now() + seconds * 1000;
    return 1;
  }
}
