/**
 * GET  /api/admin/progress/student?lab=lab-02&id=236541 — one student's attempts (with code), ticks and repo.
 * POST /api/admin/progress/student { action: 'unlock', id } | { action: 'review', id, lab, reviewed, note }
 *   | { action: 'device-lock', id, lock: true | false | null }  — one student (null = follow the setting for all)
 *   | { action: 'device-lock-all', on: boolean }               — every student (clears per-student overrides)
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { getProgressStore, json } from '@/lib/progress/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  const store = getProgressStore();
  const lab = url.searchParams.get('lab') ?? '';
  const id = (url.searchParams.get('id') ?? '').toLowerCase();
  const session = url.searchParams.get('session') ?? undefined;
  if (!store) return json({ error: 'no-database' }, 503);
  try {
    return json(await store.studentData(lab, id, session));
  } catch (err) {
    console.error('[progress] student failed', err);
    return json({ error: 'server' }, 500);
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  const store = getProgressStore();
  if (!store) return json({ error: 'no-database' }, 503);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.action === 'device-lock-all') {
    if (typeof body.on !== 'boolean') return json({ error: 'bad-request' }, 400);
    try {
      await store.setDeviceLock(body.on);
      return json({ ok: true, deviceLock: body.on });
    } catch (err) {
      console.error('[progress] device lock failed', err);
      return json({ error: 'server' }, 500);
    }
  }
  const id = String(body?.id ?? '').toLowerCase();
  if (!id) return json({ error: 'bad-request' }, 400);
  try {
    if (body?.action === 'unlock') await store.unlock(id);
    else if (body?.action === 'device-lock') {
      if (body.lock !== true && body.lock !== false && body.lock !== null) return json({ error: 'bad-request' }, 400);
      await store.setStudentDeviceLock(id, body.lock);
    }
    else if (body?.action === 'review') await store.review(id, String(body.lab ?? ''), body.reviewed === true, String(body.note ?? '').slice(0, 500), typeof body.sessionId === 'string' ? body.sessionId : undefined);
    else return json({ error: 'bad-request' }, 400);
    return json({ ok: true });
  } catch (err) {
    console.error('[progress] admin action failed', err);
    return json({ error: 'server' }, 500);
  }
};
