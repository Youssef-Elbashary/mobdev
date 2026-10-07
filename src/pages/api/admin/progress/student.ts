/**
 * GET  /api/admin/progress/student?lab=lab-02&id=236541 — one student's attempts (with code), ticks and repo.
 * POST /api/admin/progress/student { action: 'unlock', id } | { action: 'review', id, lab, reviewed, note }
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { access } from '@/lib/accounts/access';
import { canOnLab, canSeeLab } from '@/lib/accounts/labscope';
import { getProgressStore, json } from '@/lib/progress/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  const store = getProgressStore();
  const lab = url.searchParams.get('lab') ?? '';
  const id = (url.searchParams.get('id') ?? '').toLowerCase();
  const session = url.searchParams.get('session') ?? undefined;
  if (!store) return json({ error: 'no-database' }, 503);
  if (!canOnLab(await access(cookies), 'module.progress', lab)) return json({ error: 'forbidden' }, 403);
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
  const id = String(body?.id ?? '').toLowerCase();
  if (!id) return json({ error: 'bad-request' }, 400);
  const a = await access(cookies);
  if (body?.action === 'unlock' ? !a.can('module.sessions') : !canOnLab(a, 'module.progress', String(body?.lab ?? ''))) return json({ error: 'forbidden' }, 403);
  try {
    if (body?.action === 'unlock') await store.unlock(id);
    else if (body?.action === 'review') await store.review(id, String(body.lab ?? ''), body.reviewed === true, String(body.note ?? '').slice(0, 500), typeof body.sessionId === 'string' ? body.sessionId : undefined);
    else return json({ error: 'bad-request' }, 400);
    return json({ ok: true });
  } catch (err) {
    console.error('[progress] admin action failed', err);
    return json({ error: 'server' }, 500);
  }
};
