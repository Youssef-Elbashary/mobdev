/**
 * Admin: builder modules.
 *   GET                         every module with its labs (slug, title, published)
 *   POST   { title, slug? }     create a module (the slug is derived from the title when omitted)
 *   PATCH  ?slug=… { flow?, published? }   save the module canvas and/or publish it
 *   DELETE ?slug=…              delete the module and its labs (progress records are kept)
 */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import type { Permission } from '@/lib/accounts/permissions';
import { json } from '@/lib/progress/server';
import { SLUG_RE, sanitizeFlow, slugify } from '@/lib/platform/core';
import { BUILT_IN_MODULE, getPlatformStore } from '@/lib/platform/server';

export const prerender = false;

const guard = async (cookies: Parameters<typeof access>[0], perm: Permission, module?: string) => {
  if (!(await access(cookies)).can(perm, module)) return { error: json({ error: 'You do not have permission for this module.' }, 403) };
  const store = getPlatformStore();
  if (!store) return { error: json({ error: 'No database is connected.' }, 503) };
  return { store };
};

export const GET: APIRoute = async ({ cookies }) => {
  const g = await guard(cookies, 'module.build');
  if (g.error) return g.error;
  try {
    const [modules, labs] = await Promise.all([g.store.listModules(), g.store.listLabs()]);
    return json({
      modules: modules.map((m) => ({
        slug: m.slug, title: m.title, published: m.published, updated_at: m.updated_at,
        labs: labs.filter((l) => l.module === m.slug).map((l) => ({ slug: l.slug, title: l.title, published: l.published })),
      })),
    });
  } catch (error) {
    console.error('[platform] list modules failed', error);
    return json({ error: 'Could not load modules.' }, 500);
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const g = await guard(cookies, 'modules.create');
  if (g.error) return g.error;
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; slug?: unknown };
  const title = String(body.title ?? '').trim().replace(/\s+/g, ' ');
  if (!title || title.length > 120) return json({ error: 'Give the module a title (up to 120 characters).' }, 400);
  const slug = body.slug ? String(body.slug).trim() : slugify(title);
  if (!SLUG_RE.test(slug)) return json({ error: 'The address may only use lowercase letters, numbers and dashes.' }, 400);
  if (slug === BUILT_IN_MODULE.slug) return json({ error: 'That address belongs to the built-in course.' }, 409);
  try {
    const mod = await g.store.createModule(slug, title);
    return mod ? json({ module: mod }, 201) : json({ error: `A module at /m/${slug} already exists.` }, 409);
  } catch (error) {
    console.error('[platform] create module failed', error);
    return json({ error: 'Could not create the module.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  const g = await guard(cookies, 'module.build', url.searchParams.get('slug') ?? '');
  if (g.error) return g.error;
  const body = (await request.json().catch(() => ({}))) as { flow?: unknown; published?: unknown };
  let flow;
  if (body.flow !== undefined) {
    const r = sanitizeFlow(body.flow, 'module');
    if (!r.ok) return json({ error: r.error }, 400);
    flow = r.value;
  }
  if (body.published !== undefined && typeof body.published !== 'boolean') return json({ error: 'Invalid request.' }, 400);
  try {
    const mod = await g.store.saveModule(url.searchParams.get('slug') ?? '', { flow, published: body.published as boolean | undefined });
    return mod ? json({ module: mod }) : json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error('[platform] save module failed', error);
    return json({ error: 'Could not save the module.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ cookies, url }) => {
  const g = await guard(cookies, 'modules.create');
  if (g.error) return g.error;
  try {
    return (await g.store.deleteModule(url.searchParams.get('slug') ?? '')) ? json({ ok: true }) : json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error('[platform] delete module failed', error);
    return json({ error: 'Could not delete the module.' }, 500);
  }
};
