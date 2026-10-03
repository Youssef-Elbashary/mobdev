/** POST /api/admin/login — checks the password (form field "password"), sets the admin cookie. */
import type { APIRoute } from 'astro';
import { clientIp, getStore, passwordMatches, setupStatus, startAdminSession } from '@/lib/attendance/server';

export const prerender = false;

const MAX_TRIES = 10; // per IP
const WINDOW_SEC = 10 * 60; // per 10 minutes

export const POST: APIRoute = async ({ request, cookies, redirect, url, clientAddress }) => {
  if (!setupStatus().password) return redirect('/admin', 303);

  const store = getStore();
  if (store) {
    const tries = await store.hit(`login:${clientIp(request, clientAddress)}`, WINDOW_SEC).catch(() => 0);
    if (tries > MAX_TRIES) return redirect('/admin?e=wait', 303);
  }

  const form = await request.formData().catch(() => null);
  const password = String(form?.get('password') ?? '');
  if (!passwordMatches(password)) return redirect('/admin?e=wrong', 303);

  startAdminSession(cookies, url.protocol === 'https:');
  return redirect('/admin', 303);
};
