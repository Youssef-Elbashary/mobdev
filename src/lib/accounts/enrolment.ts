/**
 * Builder modules are invitation-only: their pages and labs open for staff (doctors, TAs, super admins, the
 * master password) and for students enrolled in that module (invitation accepted or added by module staff).
 * Mobile Development (the built-in course) stays open to everyone.
 */
import type { AstroCookies } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { getAccountStore, viewer } from './server';

export async function moduleAccess(cookies: AstroCookies, module: string): Promise<{ ok: boolean; signedIn: boolean }> {
  if (isAdmin(cookies)) return { ok: true, signedIn: true };
  const v = viewer(cookies);
  const store = getAccountStore();
  if (!v || !store) return { ok: false, signedIn: Boolean(v) };
  const user = await store.byId(v.u).catch(() => null);
  if (!user?.active) return { ok: false, signedIn: false };
  const enrolled = await store.enrollmentsFor(user.email).catch(() => [] as string[]);
  return { ok: enrolled.includes(module), signedIn: true };
}
