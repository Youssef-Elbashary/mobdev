/**
 * POST /api/auth/signup — a student creates an account (optional: students can still just type their
 * name and ID in each lab). { name, email, password, studentId, year, specialization, modules[] }
 */
import type { APIRoute } from 'astro';
import { clientIp } from '@/lib/attendance/server';
import { getProgressStore, json } from '@/lib/progress/server';
import { parseAccount, parseProfile } from '@/lib/accounts/core';
import { getAccountStore, publicUser, startUserSession } from '@/lib/accounts/server';
import { hubData } from '@/lib/accounts/hub';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, url, clientAddress }) => {
  const store = getAccountStore();
  if (!store) return json({ error: 'Accounts are not set up on this site yet.' }, 503);
  const tries = (await getProgressStore()?.hit(`signup:${clientIp(request, clientAddress)}`, 3600).catch(() => 0)) ?? 0;
  if (tries > 10) return json({ error: 'Too many sign-ups from this network. Try again later.' }, 429);
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const account = parseAccount({ ...body, role: 'student' }, ['student']);
  if (!account.ok) return json({ error: account.error }, 400);
  try {
    const { settings, optional } = await hubData();
    const profile = parseProfile(body, settings, optional);
    if (!profile.ok) return json({ error: profile.error }, 400);
    const user = await store.create(account.value, profile.value);
    if (!user) return json({ error: 'That email or student ID already has an account. Sign in instead.' }, 409);
    startUserSession(cookies, user, url.protocol === 'https:');
    return json({ user: publicUser(user) }, 201);
  } catch (error) {
    console.error('[accounts] signup failed', error);
    return json({ error: 'Could not create the account. Try again.' }, 500);
  }
};
