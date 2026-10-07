/**
 * Accounts, platform settings and the roles & permissions matrix (each action needs its permission).
 *   GET                                         { users?, settings, matrix, staff, invites, perms }
 *   POST   { role, name, email, password, studentId? }        create an account        (accounts.staff)
 *   POST   { action: 'invite', email, name, role }             platform invite link     (accounts.staff)
 *   PATCH  ?id=… { active?, role?, name?, password? }           manage an account        (accounts.manage)
 *   DELETE ?id=…  |  ?invite=…                                  delete account / revoke  (accounts.manage / accounts.staff)
 *   PUT    { years, specializations, builtIn }                  platform settings        (platform.settings)
 *   PUT    { matrix }                                           roles & permissions      (platform.roles, super admin)
 * Super admin accounts are made and unmade only by a super admin. Changing a password, role or disabling an
 * account signs it out everywhere.
 */
import type { APIRoute } from 'astro';
import { json } from '@/lib/progress/server';
import { ROLES, checkPasswordRules, normalEmail, parseAccount, parseSettings, type Role } from '@/lib/accounts/core';
import { PERMISSION_KEYS, parseMatrix } from '@/lib/accounts/permissions';
import { access } from '@/lib/accounts/access';
import { getAccountStore, publicUser } from '@/lib/accounts/server';
import { inviteText, mailEnabled, sendMail } from '@/lib/accounts/mail';
import { ROLE_LABEL } from '@/lib/accounts/core';

export const prerender = false;

const base = async (cookies: Parameters<typeof access>[0]) => {
  const store = getAccountStore();
  if (!store) return { error: json({ error: 'Accounts need a database and ADMIN_PASSWORD or SESSION_SECRET.' }, 503) };
  return { store, a: await access(cookies) };
};
const deny = (msg = 'You do not have permission for this.') => json({ error: msg }, 403);

export const GET: APIRoute = async ({ cookies }) => {
  const g = await base(cookies);
  if ('error' in g) return g.error;
  const { store, a } = g;
  const perms = Object.fromEntries(PERMISSION_KEYS.map((p) => [p, a.can(p)]));
  if (!Object.values(perms).some(Boolean)) return deny();
  try {
    const [users, settings, matrix, staff, invites] = await Promise.all([
      a.can('accounts.manage') || a.can('accounts.staff') ? store.list() : Promise.resolve([]),
      store.getSettings(), store.getMatrix(),
      store.listStaff(), a.can('accounts.staff') ? store.listInvites() : Promise.resolve([]),
    ]);
    return json({ users: users.map(publicUser), settings, matrix, staff, invites, perms, me: a.user?.id ?? null, mail: mailEnabled() });
  } catch (error) {
    console.error('[accounts] list failed', error);
    return json({ error: 'Could not load accounts.' }, 500);
  }
};

export const POST: APIRoute = async ({ cookies, request, url }) => {
  const g = await base(cookies);
  if ('error' in g) return g.error;
  const { store, a } = g;
  if (!a.can('accounts.staff')) return deny('Only people who create staff accounts can do this.');
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (body.role === 'super_admin' && !a.can('platform.roles')) return deny('Only the super admin can create super admins.');
  try {
    if (body.action === 'invite') {
      const email = normalEmail(body.email);
      const role = (ROLES as readonly string[]).includes(String(body.role)) ? (body.role as Role) : 'ta';
      if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return json({ error: 'Enter a valid email.' }, 400);
      const name = String(body.name ?? '').trim().slice(0, 60);
      const invite = await store.createInvite({ email, name, platform_role: role, module: null, module_role: null, invited_by: a.by });
      const link = `${url.origin}/invite/${invite.token}`;
      const text = inviteText({ name, module: null, role: ROLE_LABEL[role], link, from: a.by || 'The platform admin' });
      const sent = await sendMail(email, text.subject, text.body);
      return json({ invite, link, sent, mailto: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(text.subject)}&body=${encodeURIComponent(text.body)}` }, 201);
    }
    const acc = parseAccount(body, ROLES);
    if (!acc.ok) return json({ error: acc.error }, 400);
    const user = await store.create(acc.value);
    return user ? json({ user: publicUser(user) }, 201) : json({ error: 'That email or student ID already has an account.' }, 409);
  } catch (error) {
    console.error('[accounts] create failed', error);
    return json({ error: 'Could not create the account.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  const g = await base(cookies);
  if ('error' in g) return g.error;
  const { store, a } = g;
  if (!a.can('accounts.manage')) return deny();
  const id = url.searchParams.get('id') ?? '';
  const target = await store.byId(id);
  if (!target) return json({ error: 'Not found.' }, 404);
  if (target.role === 'super_admin' && !a.can('platform.roles')) return deny('Only the super admin can change a super admin.');
  const body = ((await request.json().catch(() => null)) ?? {}) as { active?: unknown; role?: unknown; name?: unknown; password?: unknown };
  const self = a.user?.id === id;
  const patch: { active?: boolean; role?: Role; name?: string; password?: string } = {};
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') return json({ error: 'Invalid request.' }, 400);
    if (!body.active && self) return json({ error: "You can't disable your own account." }, 400);
    patch.active = body.active;
  }
  if (body.role !== undefined) {
    if (!(ROLES as readonly string[]).includes(String(body.role))) return json({ error: 'Unknown role.' }, 400);
    if (body.role === 'super_admin' && !a.can('platform.roles')) return deny('Only the super admin can make super admins.');
    if (self) return json({ error: "You can't change your own role." }, 400);
    patch.role = body.role as Role;
  }
  if (body.name !== undefined) {
    const name = String(body.name).trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 60) return json({ error: 'Enter a full name.' }, 400);
    patch.name = name;
  }
  if (body.password !== undefined) {
    const err = checkPasswordRules(body.password);
    if (err) return json({ error: err }, 400);
    patch.password = String(body.password);
  }
  try {
    const user = await store.update(id, patch);
    return user ? json({ user: publicUser(user) }) : json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error('[accounts] update failed', error);
    return json({ error: 'Could not save.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ cookies, url }) => {
  const g = await base(cookies);
  if ('error' in g) return g.error;
  const { store, a } = g;
  try {
    const invite = url.searchParams.get('invite');
    if (invite) {
      if (!a.can('accounts.staff')) return deny();
      return (await store.revokeInvite(invite)) ? json({ ok: true }) : json({ error: 'Not found.' }, 404);
    }
    if (!a.can('accounts.manage')) return deny();
    const id = url.searchParams.get('id') ?? '';
    if (a.user?.id === id) return json({ error: "You can't delete your own account." }, 400);
    const target = await store.byId(id);
    if (target?.role === 'super_admin' && !a.can('platform.roles')) return deny('Only the super admin can delete a super admin.');
    return (await store.remove(id)) ? json({ ok: true }) : json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error('[accounts] delete failed', error);
    return json({ error: 'Could not delete.' }, 500);
  }
};

export const PUT: APIRoute = async ({ cookies, request }) => {
  const g = await base(cookies);
  if ('error' in g) return g.error;
  const { store, a } = g;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  try {
    if (body.matrix !== undefined) {
      if (!a.can('platform.roles')) return deny('Only the super admin can change roles & permissions.');
      const m = parseMatrix(body.matrix);
      if (!m) return json({ error: 'Invalid permissions.' }, 400);
      await store.setMatrix(m);
      return json({ matrix: m });
    }
    if (!a.can('platform.settings')) return deny();
    const s = parseSettings(body);
    if (!s.ok) return json({ error: s.error }, 400);
    const b = (body.builtIn && typeof body.builtIn === 'object' ? body.builtIn : {}) as Record<string, unknown>;
    const builtIn = {
      category: b.category === 'Core' ? 'Core' : 'Optional', years: String(b.years ?? '').slice(0, 200), specializations: String(b.specializations ?? '').slice(0, 600),
      semester: ['Both', 'Semester 1', 'Semester 2'].includes(String(b.semester)) ? String(b.semester) : 'Semester 1',
    };
    await Promise.all([
      store.setSetting('years', s.value.years), store.setSetting('specializations', s.value.specializations), store.setSetting('builtIn', builtIn),
      store.setSetting('activeSemester', s.value.activeSemester), store.setSetting('specFrom', s.value.specFrom),
    ]);
    return json({ settings: { ...s.value, builtIn } });
  } catch (error) {
    console.error('[accounts] settings failed', error);
    return json({ error: 'Could not save settings.' }, 500);
  }
};
