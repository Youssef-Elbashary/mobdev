/** Compatibility endpoint for the admin summary; supports every published lab and session. */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { buildDashboard, json } from '@/lib/progress/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  try {
    const data = await buildDashboard(url.searchParams.get('lab'), url.searchParams.get('session'));
    return data ? json(data) : json({ error: 'No published labs or progress database.' }, 404);
  } catch (error) {
    console.error('[admin] could not load lab summary', error);
    return json({ error: 'Could not load progress.' }, 500);
  }
};
