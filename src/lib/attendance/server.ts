/**
 * ATTENDANCE — server glue (Astro + Vercel). Business rules live in ./core.ts.
 *
 * Needs, in Vercel → Project → Settings → Environment Variables:
 *   SUPABASE_URL + SUPABASE_SECRET_KEY   (Supabase; tables from supabase/attendance.sql)
 *     — or an Upstash Redis store connected to the project (KV_REST_API_URL + KV_REST_API_TOKEN)
 *   ADMIN_PASSWORD                       (the password for /admin)
 * Secrets are read at runtime with getSecret(), so they are never baked into the build.
 * On a laptop without either database, an in-memory list is used (it resets when the dev server restarts).
 */
import type { AstroCookies } from 'astro';
import { getSecret } from 'astro:env/server';
import { Redis } from '@upstash/redis';
import {
  AttendanceStore,
  MemoryRedis,
  checkPassword,
  findRedisEnv,
  findSupabaseEnv,
  sessionSecret,
  signSession,
  verifySession,
  type AttendanceBackend,
  type RedisLike,
} from './core';
import { SupabaseStore } from './supabase';
import { viewer } from '@/lib/accounts/server';

const env = (key: string) => getSecret(key) || undefined;

function supabaseConfig() {
  return findSupabaseEnv({
    SUPABASE_URL: env('SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_URL: env('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_SECRET_KEY: env('SUPABASE_SECRET_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: env('SUPABASE_SERVICE_ROLE_KEY'),
  });
}

function redisConfig() {
  const url = env('UPSTASH_REDIS_REST_URL') ?? env('KV_REST_API_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN') ?? env('KV_REST_API_TOKEN');
  if (url && token) return { url, token };
  // names with a custom prefix (only visible through process.env on the server)
  return typeof process !== 'undefined' ? findRedisEnv(process.env) : null;
}

/** true on a Vercel deployment, false on a laptop */
const onVercel = () => Boolean(env('VERCEL'));
/** the live site uses the real list; previews and laptops use a separate test list */
const isProduction = () => env('VERCEL_ENV') === 'production';

let store: AttendanceBackend | null | undefined;
let memory: MemoryRedis | undefined;

/** The attendance store, or null when the deployment has no database yet. */
export function getStore(): AttendanceBackend | null {
  if (store !== undefined) return store;
  const sb = supabaseConfig();
  const rd = redisConfig();
  if (sb) {
    store = new SupabaseStore(sb.url, sb.key, isProduction() ? 'attendance' : 'attendance_dev');
  } else if (rd) {
    const redis = new Redis({ url: rd.url, token: rd.token, automaticDeserialization: false });
    store = new AttendanceStore(redis as unknown as RedisLike, isProduction() ? 'attendance' : 'attendance-dev');
  } else if (!onVercel()) {
    store = new AttendanceStore((memory ??= new MemoryRedis()), 'attendance-dev');
  } else {
    store = null;
  }
  return store;
}

/** What is still missing before attendance can run (shown on /admin). */
export function setupStatus() {
  return {
    database: Boolean(supabaseConfig() || redisConfig()) || !onVercel(),
    password: Boolean(env('ADMIN_PASSWORD')),
  };
}

/* ---------------------------------------------------------- admin session */

export const ADMIN_COOKIE = 'att_admin';

/** The shared ADMIN_PASSWORD login (counts as a doctor). */
export function masterAdmin(cookies: AstroCookies): boolean {
  const pw = env('ADMIN_PASSWORD');
  if (!pw) return false;
  return verifySession(cookies.get(ADMIN_COOKIE)?.value, sessionSecret(pw));
}

/** Staff: the master password, or a signed-in doctor or TA account (attendance, sessions, progress, submissions). */
export function isAdmin(cookies: AstroCookies): boolean {
  if (masterAdmin(cookies)) return true;
  const r = viewer(cookies)?.r;
  return r === 'super_admin' || r === 'doctor' || r === 'ta';
}

/** Doctors only: the master password or a doctor account (module builder, accounts, CMS). */
export function isDoctor(cookies: AstroCookies): boolean {
  const r = viewer(cookies)?.r;
  return masterAdmin(cookies) || r === 'super_admin' || r === 'doctor';
}

export function passwordMatches(input: string): boolean {
  return checkPassword(input, env('ADMIN_PASSWORD'));
}

export function startAdminSession(cookies: AstroCookies, secure: boolean) {
  const pw = env('ADMIN_PASSWORD');
  if (!pw) return;
  cookies.set(ADMIN_COOKIE, signSession(sessionSecret(pw)), {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: 12 * 60 * 60,
  });
}

export function endAdminSession(cookies: AstroCookies) {
  cookies.delete(ADMIN_COOKIE, { path: '/' });
}

/** Best-effort client IP for login rate limiting. */
export function clientIp(request: Request, clientAddress?: string): string {
  const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || request.headers.get('x-real-ip') || clientAddress || 'unknown';
}

export const noStore = { 'cache-control': 'no-store, max-age=0' };
