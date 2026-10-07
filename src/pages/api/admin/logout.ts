/** POST /api/admin/logout — clears the admin cookie. */
import type { APIRoute } from 'astro';
import { endAdminSession } from '@/lib/attendance/server';
import { endUserSession } from '@/lib/accounts/server';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  endAdminSession(cookies);
  endUserSession(cookies);
  return redirect('/admin', 303);
};
