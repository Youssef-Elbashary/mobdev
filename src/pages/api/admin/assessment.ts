/**
 * A module's assessment (components and weights).
 *   GET ?module=…                      { items, leader, canEdit }   (staff)
 *   PUT ?module=… { items: [{ label, weight, detail }] }   module leader only; weights must add up to 100
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { json } from '@/lib/progress/server';
import { parseAssessment } from '@/lib/platform/core';
import { canSetAssessment, moduleAssessment } from '@/lib/platform/assessment';
import { BUILT_IN_MODULE, getPlatformStore } from '@/lib/platform/server';

export const prerender = false;

const exists = async (module: string) => module === BUILT_IN_MODULE.slug || Boolean(await getPlatformStore()?.getModule(module));

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return json({ error: 'Unauthorized' }, 401);
  const module = url.searchParams.get('module') ?? '';
  if (!(await exists(module))) return json({ error: 'Module not found.' }, 404);
  const [a, perm] = await Promise.all([moduleAssessment(module), canSetAssessment(cookies, module)]);
  return json({ ...a, leader: perm.leader, canEdit: perm.ok });
};

export const PUT: APIRoute = async ({ cookies, url, request }) => {
  const module = url.searchParams.get('module') ?? '';
  if (!(await exists(module))) return json({ error: 'Module not found.' }, 404);
  const perm = await canSetAssessment(cookies, module);
  if (!perm.ok) return json({ error: perm.leader ? `Only the module leader (${perm.leader}) can set the assessment.` : 'Set a module leader on the module node first.' }, 403);
  const body = (await request.json().catch(() => ({}))) as { items?: unknown };
  const items = parseAssessment(body.items);
  if (!items.ok) return json({ error: items.error }, 400);
  const store = getPlatformStore();
  if (!store) return json({ error: 'No database is connected.' }, 503);
  try {
    await store.setAssessment(module, items.value, perm.by);
    return json({ items: items.value, updated_by: perm.by });
  } catch (error) {
    console.error('[platform] save assessment failed', error);
    return json({ error: 'Could not save.' }, 500);
  }
};
