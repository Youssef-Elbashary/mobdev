/** POST /api/progress/views — reading progress: { name, studentId, deviceKey, lab, seen: ['1.1', …], activeSec }. */
import type { APIRoute } from 'astro';
import { validateViews } from '@/lib/progress/core';
import { studentWrite } from '@/lib/progress/server';

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  studentWrite(request, validateViews, (store, v) => store.addViews(v.studentKey, v.lab, v.seen, v.activeSec));
