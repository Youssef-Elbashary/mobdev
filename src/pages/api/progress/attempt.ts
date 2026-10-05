/** POST /api/progress/attempt — one press of ✓ Check on an exercise: { name, studentId, deviceKey, lab, exercise, passed, total, code }. */
import type { APIRoute } from 'astro';
import { validateAttempt } from '@/lib/progress/core';
import { studentWrite } from '@/lib/progress/server';

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  studentWrite(request, validateAttempt, (store, a) =>
    store.addAttempt({ studentKey: a.studentKey, lab: a.lab, exercise: a.exercise, passed: a.passed, total: a.total, code: a.code }),
  );
