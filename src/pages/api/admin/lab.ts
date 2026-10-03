/** GET /api/admin/lab?lab=lab-02 — live lab progress for /admin (admin login required). */
import type { APIRoute } from 'astro';
import { aggregate, LABS } from '@/lib/lab/core';
import { getLabBackend } from '@/lib/lab/server';
import { isAdmin, noStore } from '@/lib/attendance/server';

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...noStore } });

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  const lab = url.searchParams.get('lab') ?? 'lab-02';
  if (!LABS[lab]) return json({ error: 'Unknown lab' }, 400);
  const backend = getLabBackend();
  if (!backend) return json({ error: 'Progress tracking is not set up yet.' }, 503);
  try {
    const { students, attempts } = await backend.rows(lab);
    return json(aggregate(lab, students, attempts));
  } catch (error) {
    console.error('[lab] could not load progress', error);
    return json({ error: 'Could not load progress.' }, 500);
  }
};
