/** POST /api/progress/task — a lab task's Done box was ticked or unticked: { name, studentId, deviceKey, lab, task, done }. */
import type { APIRoute } from 'astro';
import { validateTask } from '@/lib/progress/core';
import { studentWrite } from '@/lib/progress/server';

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  studentWrite(request, validateTask, (store, t) => store.setTask({ studentKey: t.studentKey, lab: t.lab, task: t.task, done: t.done }));
