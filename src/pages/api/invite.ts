/**
 * POST /api/invite — accept an invitation link: { token, name, password, studentId? }.
 * New email → creates the account with the invited role. Existing account → { password } signs in and joins.
 * Then adds the module role (staff) or the enrolment (student), and signs the person in.
 */
import type { APIRoute } from 'astro';
import { clientIp } from '@/lib/attendance/server';
import { getProgressStore, json } from '@/lib/progress/server';
import { parseAccount } from '@/lib/accounts/core';
import { getAccountStore, publicUser, startUserSession } from '@/lib/accounts/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, url, clientAddress }) => {
  const store = getAccountStore();
  if (!store) return json({ error: 'Accounts are not set up.' }, 503);
  const tries = (await getProgressStore()?.hit(`invite:${clientIp(request, clientAddress)}`, 600).catch(() => 0)) ?? 0;
  if (tries > 20) return json({ error: 'Too many attempts. Wait ten minutes.' }, 429);
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const invite = await store.getInvite(String(body.token ?? ''));
  if (!invite) return json({ error: 'This invitation has expired or was already used. Ask for a new one.' }, 410);
  try {
    let user = await store.byEmail(invite.email);
    if (user) {
      user = await store.login(invite.email, String(body.password ?? ''));
      if (!user) return json({ error: 'You already have an account with this email: enter its password to join.' }, 401);
      // an invite can raise a role (e.g. student → TA) but never lowers one
      const rank = { student: 0, ta: 1, doctor: 2, super_admin: 3 } as const;
      if (rank[invite.platform_role] > rank[user.role]) user = (await store.update(user.id, { role: invite.platform_role }))!;
    } else {
      const acc = parseAccount({ ...body, email: invite.email, role: invite.platform_role }, [invite.platform_role]);
      if (!acc.ok) return json({ error: acc.error }, 400);
      user = await store.create(acc.value);
      if (!user) return json({ error: 'That student ID already has an account.' }, 409);
    }
    if (invite.module && invite.module_role) await store.setStaff(invite.module, invite.email, invite.module_role, invite.invited_by);
    if (invite.module && invite.platform_role === 'student') await store.enroll(invite.module, invite.email, 'invite', invite.invited_by);
    await store.closeInvite(invite.token);
    startUserSession(cookies, user, url.protocol === 'https:');
    return json({ user: publicUser(user), module: invite.module });
  } catch (error) {
    console.error('[invite] accept failed', error);
    return json({ error: 'Could not accept the invitation. Try again.' }, 500);
  }
};
