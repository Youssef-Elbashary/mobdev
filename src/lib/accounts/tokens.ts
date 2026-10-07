/**
 * ACCOUNTS — passwords and session tokens (server only; uses node:crypto).
 * Passwords: scrypt with a random salt. Sessions: a signed, expiring token in an httpOnly cookie,
 * verified without a database round trip (isAdmin() is synchronous); `v` is the account's token version,
 * re-checked against the database on admin routes (src/middleware.ts) so revoked accounts sign out at once.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Role } from './core.ts';

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1 });
  return `s1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  const [scheme, salt, hash] = (stored ?? '').split('$');
  if (scheme !== 's1' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, { N: 16384, r: 8, p: 1 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type TokenClaims = { u: string; r: Role; n: string; v: number; exp: number };
const mac = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest('base64url');

export function signToken(claims: Omit<TokenClaims, 'exp'>, secret: string, ttlMs: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...claims, exp: now + ttlMs })).toString('base64url');
  return `u1.${body}.${mac(secret, `u1.${body}`)}`;
}

export function verifyToken(token: string | undefined, secret: string, now = Date.now()): TokenClaims | null {
  if (!token || !secret) return null;
  const [ver, body, sig] = token.split('.');
  if (ver !== 'u1' || !body || !sig) return null;
  const expected = mac(secret, `u1.${body}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const c = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenClaims;
    if (typeof c.u !== 'string' || !['super_admin', 'doctor', 'ta', 'student'].includes(c.r) || !(c.exp > now)) return null;
    return c;
  } catch {
    return null;
  }
}
