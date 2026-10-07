/**
 * The signed-in account (or null), for the nav chip, the module hub, the profile page and lab sign-in.
 *   GET    { user, staff, doctor, accounts, enrolled[], staffModules{}, builderModules[] }
 *   PATCH  { name?, year?, specialization?, modules?, currentPassword?, newPassword? }   edit your own profile
 * Students choose only the self-enrolment optional modules (Mobile Development); every other module needs an
 * invitation or enrolment by its staff.
 */
import type { APIRoute } from 'astro';
import { isAdmin, isDoctor } from '@/lib/attendance/server';
import { json } from '@/lib/progress/server';
import { NAME_RE, checkPasswordRules, parseProfile } from '@/lib/accounts/core';
import { getAccountStore, publicUser, startUserSession, viewer } from '@/lib/accounts/server';
import { verifyPassword } from '@/lib/accounts/tokens';
import { hubData } from '@/lib/accounts/hub';
import { access } from '@/lib/accounts/access';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const claims = viewer(cookies);
  const store = getAccountStore();
  const user = claims && store ? await store.byId(claims.u).catch(() => null) : null;
  const active = user && user.active ? user : null;
  const [enrolled, staffModules] = active && store
    ? await Promise.all([store.enrollmentsFor(active.email).catch(() => []), store.staffFor(active.email).catch(() => ({}))])
    : [[], {}];
  const rights = await access(cookies);
  const builderModules = (await hubData()).cards
    .filter((module) => !module.builtIn && rights.can('module.build', module.slug))
    .map((module) => module.slug);
  return json({ user: active ? publicUser(active) : null, staff: isAdmin(cookies), doctor: isDoctor(cookies), accounts: Boolean(store), enrolled, staffModules, builderModules });
};

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  const claims = viewer(cookies);
  const store = getAccountStore();
  if (!claims || !store) return json({ error: 'Sign in first.' }, 401);
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  try {
    let user = await store.byId(claims.u);
    if (!user || !user.active) return json({ error: 'Account not found.' }, 404);

    if (body.name !== undefined) {
      const name = String(body.name).normalize('NFC').trim().replace(/\s+/g, ' ');
      if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) return json({ error: 'Enter a full name (letters only).' }, 400);
      user = (await store.update(user.id, { name }))!;
    }
    if (body.year !== undefined || body.specialization !== undefined || body.modules !== undefined) {
      const { settings, optional } = await hubData();
      const profile = parseProfile({ year: user.profile.year, specialization: user.profile.specialization, modules: user.profile.modules, ...body }, settings, optional);
      if (!profile.ok) return json({ error: profile.error }, 400);
      user = (await store.setProfile(user.id, profile.value))!;
    }
    if (body.newPassword !== undefined) {
      if (!verifyPassword(String(body.currentPassword ?? ''), user.password_hash)) return json({ error: 'Your current password is wrong.' }, 400);
      const err = checkPasswordRules(body.newPassword);
      if (err) return json({ error: err }, 400);
      user = (await store.update(user.id, { password: String(body.newPassword) }))!;
      startUserSession(cookies, user, url.protocol === 'https:'); // a new password signs out other devices, not this one
    }
    return json({ user: publicUser(user) });
  } catch (error) {
    console.error('[accounts] profile update failed', error);
    return json({ error: 'Could not save. Try again.' }, 500);
  }
};
