/**
 * Admin: labs of a builder module.
 *   POST   { module, title, slug? }                 create a lab (empty flow with just its Lab node)
 *   PATCH  ?module=…&slug=… { flow?, published? }   save the lab canvas and/or publish it; returns compile warnings
 *   DELETE ?module=…&slug=…                         delete the lab (progress records are kept)
 */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import type { Permission } from '@/lib/accounts/permissions';
import { json } from '@/lib/progress/server';
import { SLUG_RE, compileLab, labKey, sanitizeFlow, slugify } from '@/lib/platform/core';
import { getPlatformStore } from '@/lib/platform/server';

export const prerender = false;

const guard = async (cookies: Parameters<typeof access>[0], perm: Permission, module?: string) => {
  if (!(await access(cookies)).can(perm, module)) return { error: json({ error: 'You do not have permission for this module.' }, 403) };
  const store = getPlatformStore();
  if (!store) return { error: json({ error: 'No database is connected.' }, 503) };
  return { store };
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const body = (await request.json().catch(() => ({}))) as { module?: unknown; title?: unknown; slug?: unknown };
  const module = String(body.module ?? '');
  const g = await guard(cookies, 'module.build', module);
  if (g.error) return g.error;
  const title = String(body.title ?? '').trim().replace(/\s+/g, ' ');
  if (!title || title.length > 120) return json({ error: 'Give the lab a title (up to 120 characters).' }, 400);
  try {
    if (!(await g.store.getModule(module))) return json({ error: 'Module not found.' }, 404);
    const existing = new Set((await g.store.listLabs(module)).map((l) => l.slug));
    let slug = body.slug ? String(body.slug).trim() : slugify(title);
    if (!SLUG_RE.test(slug)) return json({ error: 'The address may only use lowercase letters, numbers and dashes.' }, 400);
    if (!body.slug) for (let n = 2; existing.has(slug); n++) slug = `${slugify(title)}-${n}`;
    const lab = await g.store.createLab(module, slug, title);
    return lab ? json({ lab }, 201) : json({ error: `A lab at /m/${module}/${slug} already exists.` }, 409);
  } catch (error) {
    console.error('[platform] create lab failed', error);
    return json({ error: 'Could not create the lab.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  const module = url.searchParams.get('module') ?? '';
  const g = await guard(cookies, 'module.build', module);
  if (g.error) return g.error;
  const slug = url.searchParams.get('slug') ?? '';
  const body = (await request.json().catch(() => ({}))) as { flow?: unknown; published?: unknown };
  let flow;
  if (body.flow !== undefined) {
    const r = sanitizeFlow(body.flow, 'lab');
    if (!r.ok) return json({ error: r.error }, 400);
    flow = r.value;
  }
  if (body.published !== undefined && typeof body.published !== 'boolean') return json({ error: 'Invalid request.' }, 400);
  try {
    const lab = await g.store.saveLab(module, slug, { flow, published: body.published as boolean | undefined });
    if (!lab) return json({ error: 'Not found.' }, 404);
    const c = compileLab(lab.flow, labKey(module, slug));
    return json({ lab, warnings: c.warnings, stats: { tasks: c.blocks.filter((b) => b.kind === 'task').length, exercises: Object.keys(c.exercises).length } });
  } catch (error) {
    console.error('[platform] save lab failed', error);
    return json({ error: 'Could not save the lab.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ cookies, url }) => {
  const g = await guard(cookies, 'module.build', url.searchParams.get('module') ?? '');
  if (g.error) return g.error;
  try {
    const ok = await g.store.deleteLab(url.searchParams.get('module') ?? '', url.searchParams.get('slug') ?? '');
    return ok ? json({ ok: true }) : json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error('[platform] delete lab failed', error);
    return json({ error: 'Could not delete the lab.' }, 500);
  }
};
