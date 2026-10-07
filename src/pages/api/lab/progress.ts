/**
 * POST /api/lab/progress — a student's browser reports lab progress (start / check / hint).
 * Body: { lab, name, studentId, deviceId, event, exercise?, result?, score? }  (see src/lab/ui/tracker.ts)
 */
import type { APIRoute } from 'astro';
import { validateLabEvent } from '@/lib/lab/core';
import { getLabBackend } from '@/lib/lab/server';
import { sessionState } from '@/lib/progress/core';
import { getProgressStore, getStructures } from '@/lib/progress/server';
import { noStore } from '@/lib/attendance/server';

export const prerender = false;

const MAX_EVENTS = 300; // per device
const WINDOW_SEC = 10 * 60; // per 10 minutes

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...noStore } });

export const POST: APIRoute = async ({ request }) => {
  const backend = getLabBackend();
  if (!backend) return json({ ok: false, error: 'Progress tracking is not set up yet.' }, 503);

  const body = await request.json().catch(() => null);
  const labs = await getStructures().catch(() => []);
  const v = validateLabEvent(body, (lab) => labs.some((l) => l.lab === lab));
  if (!v.ok) return json({ ok: false, error: v.error }, 400);

  const progress = getProgressStore();
  const session = progress ? await progress.getSessionById(v.event.sessionId).catch(() => null) : null;
  if (!session || session.lab !== v.event.lab || !sessionState(session, Date.now()).open) {
    return json({ ok: false, error: 'session-closed', message: 'Your TA has not started this lab session yet. You can read the content, but you cannot start or record attendance.' }, 403);
  }
  if (v.event.event !== 'start' && !(await progress!.isSessionStudent(v.event.sessionId, v.event.studentKey))) {
    return json({ ok: false, error: 'not-started', message: 'Enter your name, ID and group at the top of the lab first.' }, 403);
  }

  const tries = await backend.hit(`device:${v.event.deviceId}`, WINDOW_SEC).catch(() => 0);
  if (tries > MAX_EVENTS) return json({ ok: false, error: 'Too many events — slow down a little.' }, 429);

  try {
    await backend.record(v.event);
  } catch (error) {
    if (error instanceof Error && error.message === 'identity-conflict') {
      return json({ ok: false, error: 'identity-conflict', message: 'This browser is already linked to another student, or this student ID is linked to another device. Ask your TA to use “Allow new device”.' }, 409);
    }
    console.error('[lab] could not record progress', error);
    return json({ ok: false, error: 'Could not save progress.' }, 500);
  }
  return json({ ok: true });
};
