/** POST /api/progress/checkin — end-of-lab check-in: { name, studentId, deviceKey, lab }. Only while the admin has it open. */
import type { APIRoute } from 'astro';
import { sessionState, validateCheckin } from '@/lib/progress/core';
import { json, studentWrite } from '@/lib/progress/server';

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  studentWrite(request, validateCheckin, async (store, c) => {
    if (!sessionState(await store.getSession(c.lab), Date.now()).open) {
      return json({ error: 'closed', message: 'Check-in for this lab is closed. Ask your TA.' }, 403);
    }
    return { at: await store.checkIn(c.studentKey, c.lab) };
  });
