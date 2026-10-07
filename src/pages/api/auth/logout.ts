/** POST /api/auth/logout — signs the account out (the master /admin password session too). */
import type { APIRoute } from 'astro';
import { endAdminSession } from '@/lib/attendance/server';
import { endUserSession } from '@/lib/accounts/server';
import { json } from '@/lib/progress/server';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  endUserSession(cookies);
  endAdminSession(cookies);
  return json({ ok: true });
};
