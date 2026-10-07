/** POST /api/auth/login — { email, password } → signs in a doctor, TA or student (rate-limited per IP). */
import type { APIRoute } from 'astro';
import { clientIp } from '@/lib/attendance/server';
import { getProgressStore, json } from '@/lib/progress/server';
import { normalEmail } from '@/lib/accounts/core';
import { getAccountStore, publicUser, startUserSession } from '@/lib/accounts/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, url, clientAddress }) => {
  const store = getAccountStore();
  if (!store) return json({ error: 'Accounts are not set up on this site yet.' }, 503);
  const tries = (await getProgressStore()?.hit(`login:${clientIp(request, clientAddress)}`, 600).catch(() => 0)) ?? 0;
  if (tries > 15) return json({ error: 'Too many attempts. Wait ten minutes and try again.' }, 429);
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  try {
    const user = await store.login(normalEmail(body.email), String(body.password ?? ''));
    if (!user) return json({ error: 'Wrong email or password, or the account is disabled.' }, 401);
    startUserSession(cookies, user, url.protocol === 'https:');
    return json({ user: publicUser(user) });
  } catch (error) {
    console.error('[accounts] login failed', error);
    return json({ error: 'Could not sign in. Try again.' }, 500);
  }
};
