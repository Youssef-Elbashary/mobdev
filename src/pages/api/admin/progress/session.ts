/**
 * POST /api/admin/progress/session — { lab, action: 'open', minutes: 15 | 30 | 60 | null } or { lab, action: 'close' },
 * or { lab, action: 'practice', on: boolean } to let students solve the lab without a session.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { access } from '@/lib/accounts/access';
import { canOnLab, canSeeLab } from '@/lib/accounts/labscope';
import { sessionState } from '@/lib/progress/core';
import { sessionDetails } from '@/lib/progress/session-input';
import { getProgressStore, getStructures, json } from '@/lib/progress/server';

export const prerender = false;

const LENGTHS = [15, 30, 60, 90, 120, 180];
export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  const store = getProgressStore();
  if (!store) return json({ error: 'no-database' }, 503);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const lab = String(body?.lab ?? '');
  if (!(await getStructures()).some((l) => l.lab === lab)) return json({ error: 'bad-request' }, 400);
  if (!canOnLab(await access(cookies), 'module.sessions', lab)) return json({ error: 'forbidden', message: 'You do not run sessions for this module.' }, 403);
  try {
    const action = String(body?.action ?? '');
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    const readDetails = () => sessionDetails(body?.taName, body?.timeSlot);
    const minutes = body?.minutes === undefined ? 90 : body.minutes == null || body.minutes === '' ? null : Number(body.minutes);
    if (['create', 'update', 'open', 'start'].includes(action) && minutes !== null && !LENGTHS.includes(minutes)) return json({ error: 'bad-request', message: 'Choose a valid session duration.' }, 400);

    if (action === 'practice') {
      if (typeof body?.on !== 'boolean') return json({ error: 'bad-request' }, 400);
      await store.setPractice(lab, body.on);
      return json({ ok: true, practice: body.on });
    }

    let changed = null;
    if (action === 'create' || action === 'open') {
      const { taName, timeSlot, valid } = readDetails();
      if (!valid) return json({ error: 'invalid', message: 'Enter the TA name and a valid time slot.' }, 400);
      changed = action === 'open'
        ? await store.openSession(lab, minutes, taName, timeSlot)
        : await store.createSession(lab, taName, timeSlot, minutes);
    } else if (action === 'update') {
      const { taName, timeSlot, valid } = readDetails();
      if (!sessionId || !valid) return json({ error: 'invalid', message: 'Enter the TA name and a valid time slot.' }, 400);
      changed = await store.updateSession(lab, sessionId, taName, timeSlot, minutes);
    } else if (action === 'start') {
      if (!sessionId) return json({ error: 'bad-request' }, 400);
      changed = await store.startSession(lab, sessionId, minutes);
    } else if (action === 'close') {
      if (!sessionId) return json({ error: 'bad-request' }, 400);
      await store.closeSession(lab, sessionId);
      changed = await store.getSessionById(sessionId);
    } else if (action === 'delete') {
      if (!sessionId) return json({ error: 'bad-request' }, 400);
      const deleted = await store.deleteSession(lab, sessionId);
      return deleted ? json({ ok: true, deleted: sessionId }) : json({ error: 'not-found' }, 404);
    } else return json({ error: 'bad-request' }, 400);

    if (!changed) return json({ error: 'not-found' }, 404);
    return json({ ok: true, session: { ...changed, ...sessionState(changed, Date.now()) } });
  } catch (err) {
    console.error('[progress] session change failed', err);
    return json({ error: 'server' }, 500);
  }
};
