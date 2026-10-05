/** POST /api/cms/editor { name } — who is editing (a teaching-team name; written into every commit). DELETE clears it. */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { EDITOR_COOKIE, editors, json, setEditor } from '@/lib/cms/server';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, request, url }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = String(body?.name ?? '');
  if (!editors().some((e) => e.name === name)) return json({ error: 'invalid', message: 'Pick a name from the teaching team.' }, 400);
  setEditor(cookies, name, url.protocol === 'https:');
  return json({ ok: true, editor: name });
};

export const DELETE: APIRoute = async ({ cookies }) => {
  cookies.delete(EDITOR_COOKIE, { path: '/' });
  return json({ ok: true });
};
