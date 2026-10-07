/**
 * POST /api/cms/editor { name } — who is editing (a doctor or TA of any module; written into every commit).
 * Only needed with the shared admin password: signed-in staff always edit as themselves. DELETE clears it.
 */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import { EDITOR_COOKIE, editorDirectory, json, setEditor } from '@/lib/cms/server';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, request, url }) => {
  if (!(await access(cookies)).can('cms.edit')) return json({ error: 'unauthorised' }, 401);
  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = String(body?.name ?? '');
  const { modules } = await editorDirectory();
  if (!modules.some((m) => [...m.doctors, ...m.tas].some((p) => p.name === name))) return json({ error: 'invalid', message: 'Pick a doctor or TA from a module’s teaching team.' }, 400);
  setEditor(cookies, name, url.protocol === 'https:');
  return json({ ok: true, editor: name });
};

export const DELETE: APIRoute = async ({ cookies }) => {
  cookies.delete(EDITOR_COOKIE, { path: '/' });
  return json({ ok: true });
};
