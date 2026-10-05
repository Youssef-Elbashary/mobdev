/** POST /api/progress/submission — the student's GitHub repository for a lab: { name, studentId, deviceKey, lab, url }. */
import type { APIRoute } from 'astro';
import { validateSubmission } from '@/lib/progress/core';
import { studentWrite } from '@/lib/progress/server';

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  studentWrite(request, validateSubmission, (store, s) => store.setSubmission({ studentKey: s.studentKey, lab: s.lab, url: s.url }));
