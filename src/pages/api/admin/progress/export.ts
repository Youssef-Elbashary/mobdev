/** GET /api/admin/progress/export?lab=lab-02 — the students table as CSV (for grading). */
import type { APIRoute } from 'astro';
import { isAdmin, noStore } from '@/lib/attendance/server';
import { toCsv } from '@/lib/progress/core';
import { buildDashboard } from '@/lib/progress/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return new Response('Unauthorised', { status: 401 });
  const d = await buildDashboard(url.searchParams.get('lab'));
  if (!d) return new Response('No data', { status: 404 });
  const ex = d.structure.exercises;
  const rows: (string | number)[][] = [
    ['Name', 'Student ID', 'Attended', 'Check-in time', 'Progress %', 'Exercises solved', ...ex.map((e) => `${e.id} (best)`), 'Tasks done', 'Tasks seen', 'Active minutes', 'Repository', 'Reviewed', 'Last seen'],
    ...d.students.map((s) => [
      s.name,
      s.id,
      s.attended ? 'yes' : 'no',
      s.attended ?? '',
      s.percent,
      `${s.solved}/${ex.length}`,
      ...ex.map((e) => (s.cells[e.id] ? `${s.cells[e.id].passed}/${s.cells[e.id].total}` : '')),
      `${s.tasksDone}/${d.structure.tasks.length}`,
      `${s.seen}/${d.structure.tasks.length}`,
      Math.round(s.activeSec / 60),
      s.submission?.url ?? '',
      s.submission?.reviewed ? 'yes' : '',
      s.lastSeen,
    ]),
  ];
  return new Response('﻿' + toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${d.structure.lab}-progress.csv"`,
      ...noStore,
    },
  });
};
