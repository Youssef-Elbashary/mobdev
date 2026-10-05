/**
 * POST /api/lab/progress — a student's browser reports lab progress (start / check / hint).
 * Body: { lab, name, studentId, deviceId, event, exercise?, result?, score? }  (see src/lab/ui/tracker.ts)
 */
import type { APIRoute } from 'astro';
import { validateLabEvent } from '@/lib/lab/core';
import { getLabBackend } from '@/lib/lab/server';
import { noStore } from '@/lib/attendance/server';

export const prerender = false;

const MAX_EVENTS = 300; // per device
const WINDOW_SEC = 10 * 60; // per 10 minutes

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...noStore } });

export const POST: APIRoute = async ({ request }) => {
  const backend = getLabBackend();
  if (!backend) return json({ ok: false, error: 'Progress tracking is not set up yet.' }, 503);

  const body = await request.json().catch(() => null);
  const v = validateLabEvent(body);
  if (!v.ok) return json({ ok: false, error: v.error }, 400);

  const tries = await backend.hit(`device:${v.event.deviceId}`, WINDOW_SEC).catch(() => 0);
  if (tries > MAX_EVENTS) return json({ ok: false, error: 'Too many events — slow down a little.' }, 429);

  try {
    await backend.record(v.event);
  } catch (error) {
    console.error('[lab] could not record progress', error);
    return json({ ok: false, error: 'Could not save progress.' }, 500);
  }
  return json({ ok: true });
};
