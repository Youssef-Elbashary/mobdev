/**
 * GET  /api/admin/progress/student?lab=lab-02&id=236541 — one student's attempts (with code), ticks and repo.
 * POST /api/admin/progress/student { action: 'unlock', id } | { action: 'review', id, lab, reviewed, note }
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
  if (!store) return json({ error: 'no-database' }, 503);
  try {
    return json(await store.studentData(lab, id));
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
  const id = String(body?.id ?? '').toLowerCase();
  if (!id) return json({ error: 'bad-request' }, 400);
  try {
    if (body?.action === 'unlock') await store.unlock(id);
    else if (body?.action === 'review') await store.review(id, String(body.lab ?? ''), body.reviewed === true, String(body.note ?? '').slice(0, 500));
    else return json({ error: 'bad-request' }, 400);
    return json({ ok: true });
  } catch (err) {
    console.error('[progress] admin action failed', err);
    return json({ error: 'server' }, 500);
  }
};
