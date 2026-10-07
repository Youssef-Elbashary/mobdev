/**
 * A module's people — for whoever has `module.invite` on it (module leaders by default, the super admin).
 *   GET    ?module=…                                       { staff, students, invites, canAssignLeader }
 *   POST   ?module=… { action: 'invite', email, name, kind: 'staff'|'student', platformRole?, moduleRole? }
 *            → a single-use link (emailed when a mail provider is set up)
 *   POST   ?module=… { action: 'create', email, name, password, kind, studentId?, platformRole?, moduleRole? }
 *            → creates the account now (temporary password) and adds it to the module
 *   POST   ?module=… { action: 'enroll', emails: [...] }  enrol students (they need not have an account yet)
 *   POST   ?module=… { action: 'staff', email, moduleRole } add or change a staff member's module role
 *   DELETE ?module=…&kind=staff|student|invite&key=…      remove a staff member / student, revoke an invite
 * Platform roles a module leader can hand out: TA or doctor (super admin only by the super admin).
 */
import type { APIRoute } from 'astro';
import { json } from '@/lib/progress/server';
import { access } from '@/lib/accounts/access';
import { normalEmail, parseAccount } from '@/lib/accounts/core';
import { MODULE_ROLES, ROLE_NAMES, type ModuleRole } from '@/lib/accounts/permissions';
import { getAccountStore, publicUser } from '@/lib/accounts/server';
import { inviteText, mailEnabled, sendMail } from '@/lib/accounts/mail';
import { BUILT_IN_MODULE, getPlatformStore } from '@/lib/platform/server';

export const prerender = false;
const EMAIL_RE = /^[^\s@<>()",;]{1,64}@[^\s@<>()",;]{1,190}\.[A-Za-z]{2,24}$/;

async function moduleTitle(slug: string): Promise<string | null> {
  if (slug === BUILT_IN_MODULE.slug) return BUILT_IN_MODULE.title;
  return (await getPlatformStore()?.getModule(slug))?.title ?? null;
}

async function guard(cookies: Parameters<typeof access>[0], module: string) {
  const store = getAccountStore();
  if (!store) return { error: json({ error: 'Accounts are not set up.' }, 503) };
  const title = await moduleTitle(module);
  if (!title) return { error: json({ error: 'Module not found.' }, 404) };
  const a = await access(cookies);
  if (!a.can('module.invite', module)) return { error: json({ error: 'Only the module leader can manage this module’s people.' }, 403) };
  return { store, a, title };
}

export const GET: APIRoute = async ({ cookies, url }) => {
  const module = url.searchParams.get('module') ?? '';
  const g = await guard(cookies, module);
  if ('error' in g) return g.error;
  const [staff, students, invites] = await Promise.all([g.store.listStaff(module), g.store.listEnrollments(module), g.store.listInvites(module)]);
  const users = new Map((await g.store.list()).map((u) => [u.email, u]));
  return json({
    module, title: g.title, mail: mailEnabled(), canAssignLeader: g.a.can('platform.roles'),
    staff: staff.map((s) => ({ ...s, name: users.get(s.email)?.name ?? null, hasAccount: users.has(s.email), platformRole: users.get(s.email)?.role ?? null })),
    students, invites,
  });
};

export const POST: APIRoute = async ({ cookies, url, request }) => {
  const module = url.searchParams.get('module') ?? '';
  const g = await guard(cookies, module);
  if ('error' in g) return g.error;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const action = String(body.action ?? '');
  const kind = body.kind === 'student' ? 'student' : 'staff';
  const moduleRole = String(body.moduleRole ?? 'ta') as ModuleRole;
  const platformRole = kind === 'student' ? 'student' : body.platformRole === 'doctor' ? 'doctor' : 'ta';
  if (kind === 'staff' && !(MODULE_ROLES as readonly string[]).includes(moduleRole)) return json({ error: 'Choose a module role.' }, 400);
  if (kind === 'staff' && moduleRole === 'leader' && !g.a.can('platform.roles')) return json({ error: 'Only the super admin can appoint a module leader.' }, 403);

  try {
    if (action === 'enroll') {
      const emails = (Array.isArray(body.emails) ? body.emails : String(body.emails ?? '').split(/[\s,;]+/)).map(normalEmail).filter(Boolean);
      const bad = emails.filter((e) => !EMAIL_RE.test(e));
      if (!emails.length || bad.length) return json({ error: bad.length ? `Not an email: ${bad[0]}` : 'Add at least one email.' }, 400);
      for (const e of emails.slice(0, 500)) await g.store.enroll(module, e, 'staff', g.a.by);
      return json({ enrolled: emails.length });
    }
    if (action === 'staff') {
      const email = normalEmail(body.email);
      if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email.' }, 400);
      await g.store.setStaff(module, email, moduleRole, g.a.by);
      return json({ ok: true });
    }
    if (action === 'invite') {
      const email = normalEmail(body.email);
      const name = String(body.name ?? '').trim().slice(0, 60);
      if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email.' }, 400);
      const invite = await g.store.createInvite({ email, name, platform_role: platformRole, module, module_role: kind === 'staff' ? moduleRole : null, invited_by: g.a.by });
      const link = `${url.origin}/invite/${invite.token}`;
      const text = inviteText({ name, module: g.title, role: kind === 'student' ? 'a student' : ROLE_NAMES[moduleRole], link, from: g.a.by || 'Your module leader' });
      const sent = await sendMail(email, text.subject, text.body);
      return json({ invite, link, sent, mailto: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(text.subject)}&body=${encodeURIComponent(text.body)}` }, 201);
    }
    if (action === 'create') {
      const acc = parseAccount({ ...body, role: platformRole }, [platformRole]);
      if (!acc.ok) return json({ error: acc.error }, 400);
      const user = await g.store.create(acc.value);
      if (!user) return json({ error: 'That email or student ID already has an account. Add them by email instead.' }, 409);
      if (kind === 'student') await g.store.enroll(module, user.email, 'staff', g.a.by);
      else await g.store.setStaff(module, user.email, moduleRole, g.a.by);
      return json({ user: publicUser(user) }, 201);
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    console.error('[team] action failed', error);
    return json({ error: 'Could not save.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ cookies, url }) => {
  const module = url.searchParams.get('module') ?? '';
  const g = await guard(cookies, module);
  if ('error' in g) return g.error;
  const kind = url.searchParams.get('kind');
  const key = url.searchParams.get('key') ?? '';
  try {
    const ok = kind === 'staff' ? await g.store.removeStaff(module, key)
      : kind === 'student' ? await g.store.unenroll(module, key)
      : kind === 'invite' ? Boolean(await g.store.revokeInvite(key)) : false;
    return ok ? json({ ok: true }) : json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error('[team] delete failed', error);
    return json({ error: 'Could not remove.' }, 500);
  }
};
