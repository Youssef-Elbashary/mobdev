/** POST /api/progress/checkin — end-of-lab check-in: { name, studentId, deviceKey, lab }. Only while the admin has it open. */
import type { APIRoute } from 'astro';
import { clientIp } from '@/lib/attendance/server';
import { ATTENDANCE_MIN_ACTIVE_SEC, ATTENDANCE_MIN_SEEN, attendanceEligibility, sessionState, validateCheckin } from '@/lib/progress/core';
import { getProgressStore, getStructures, json } from '@/lib/progress/server';

export const prerender = false;

const WINDOW_SEC = 10 * 60;
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await request.json().catch(() => null);
  const valid = validateCheckin(body, await getStructures());
  if (!valid.ok) return json({ error: 'invalid', errors: valid.errors }, 400);

  const store = getProgressStore();
  if (!store) return json({ error: 'closed', message: 'Attendance storage is not set up.' }, 503);
  const c = valid.value;
  const sessionId = String((body as Record<string, unknown>)?.sessionId ?? '');

  try {
    const session = sessionId ? await store.getSessionById(sessionId) : null;
    if (!session || session.lab !== c.lab) return json({ error: 'closed', message: 'This lab session is not active.' }, 403);
    const existing = await store.studentData(c.lab, c.studentKey, sessionId);
    // An accepted check-in is immutable and idempotent. Return it before checking
    // the current browser binding so a repaired/migrated device ID cannot turn an
    // already-successful attendance record into a misleading device error.
    if (existing.checkin) return json({ ok: true, at: existing.checkin });
    const activeSec = existing.views?.active_sec ?? 0;
    const seen = existing.views?.seen.length ?? 0;
    const eligible = attendanceEligibility({ student: existing.student, name: c.name, deviceKey: c.deviceKey, activeSec, seen });
    if (!eligible.ok && eligible.reason === 'identity') {
      return json(
        { error: 'identity', message: 'This check-in does not match the student identity and device that started the lab. Ask your TA to verify it.' },
        409,
      );
    }
    // Count a student-specific attempt only after its device and immutable name
    // match. Otherwise an attacker who knows an ID could lock that student out.
    const [deviceTries, studentTries, networkTries] = await Promise.all([
      store.hit(`checkin:${sessionId}:device:${c.deviceKey}`, WINDOW_SEC),
      store.hit(`checkin:${sessionId}:student:${c.studentKey}`, WINDOW_SEC),
      store.hit(`checkin:network:${clientIp(request, clientAddress)}`, WINDOW_SEC),
    ]);
    // The network ceiling is intentionally high because a whole lab may share campus Wi-Fi.
    if (deviceTries > 8 || studentTries > 8 || networkTries > 250) {
      return json({ error: 'slow-down', message: 'Too many check-in attempts. Wait ten minutes or ask your TA.' }, 429);
    }

    if (!sessionState(session, Date.now()).open) {
      return json({ error: 'closed', message: 'Check-in for this lab is closed. Ask your TA.' }, 403);
    }

    if (!eligible.ok) {
      return json(
        {
          error: 'participation',
          message: `Attendance needs at least 5 active minutes and 3 viewed lab sections on this same device. Recorded: ${Math.floor(activeSec / 60)} min and ${seen} sections.`,
          requirements: { activeSec: ATTENDANCE_MIN_ACTIVE_SEC, seen: ATTENDANCE_MIN_SEEN },
        },
        403,
      );
    }

    return json({ ok: true, at: await store.checkIn(c.studentKey, c.lab, sessionId) });
  } catch (error) {
    console.error('[progress] secure check-in failed', error);
    return json({ error: 'server', message: 'Could not verify attendance. Try again in a moment.' }, 500);
  }
};
