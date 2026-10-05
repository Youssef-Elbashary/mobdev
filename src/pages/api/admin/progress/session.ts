/** POST /api/admin/progress/session — { lab, action: 'open', minutes: 15 | 30 | 60 | null } or { lab, action: 'close' }. */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { sessionState } from '@/lib/progress/core';
import { getProgressStore, getStructures, json } from '@/lib/progress/server';

export const prerender = false;

const LENGTHS = [15, 30, 60];

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  const store = getProgressStore();
  if (!store) return json({ error: 'no-database' }, 503);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const lab = String(body?.lab ?? '');
  if (!(await getStructures()).some((l) => l.lab === lab)) return json({ error: 'bad-request' }, 400);
  try {
    if (body?.action === 'open') {
      const minutes = body.minutes == null ? null : Number(body.minutes);
      if (minutes !== null && !LENGTHS.includes(minutes)) return json({ error: 'bad-request' }, 400);
      await store.openSession(lab, minutes);
    } else if (body?.action === 'close') await store.closeSession(lab);
    else return json({ error: 'bad-request' }, 400);
    return json(sessionState(await store.getSession(lab), Date.now()));
  } catch (err) {
    console.error('[progress] session change failed', err);
    return json({ error: 'server' }, 500);
  }
};
