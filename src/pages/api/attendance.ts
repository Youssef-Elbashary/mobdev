/** POST /api/attendance — a student checks in with { name, studentId, deviceId }. */
import type { APIRoute } from 'astro';
import { validateCheckIn } from '@/lib/attendance/core';
import { getStore, noStore } from '@/lib/attendance/server';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...noStore } });

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad-request', message: 'Something went wrong. Refresh the page and try again.' }, 400);
  }

  const v = validateCheckIn(body);
  if (!v.ok) return json({ error: 'invalid', errors: v.errors }, 400);

  const store = getStore();
  if (!store) return json({ error: 'closed', message: 'Attendance is not open yet. Please tell your TA.' }, 503);

  try {
    const r = await store.checkIn({ name: v.name, studentId: v.studentId, deviceId: v.deviceId, at: new Date().toISOString() });
    switch (r.status) {
      case 'ok':
        return json({ ok: true, entry: r.entry }, 201);
      case 'device':
        return json({ error: 'device', entry: r.entry ?? null, message: 'This device has already been used to check in.' }, 409);
      case 'id':
        return json({ error: 'id', errors: { studentId: 'This student ID is already checked in.' } }, 409);
      case 'full':
        return json({ error: 'full', message: 'The attendance list is full. Please tell your TA.' }, 503);
    }
  } catch (err) {
    console.error('[attendance] check-in failed', err);
    return json({ error: 'server', message: 'Something went wrong on our side. Please try again.' }, 500);
  }
};
