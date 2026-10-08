/** Module announcements: create, edit, publish/unpublish and delete banners. */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import { json } from '@/lib/progress/server';
import { parseModuleBanner } from '@/lib/platform/banner';
import { BUILT_IN_MODULE, getPlatformStore } from '@/lib/platform/server';

export const prerender = false;

const guard = async (cookies: Parameters<typeof access>[0], module: string) => {
  const a = await access(cookies);
  if (!module || (!a.can('module.build', module) && !a.can('module.submissions', module))) {
    return { error: json({ error: 'You do not have permission to manage this module’s banners.' }, 403) };
  }
  const store = getPlatformStore();
  if (!store) return { error: json({ error: 'No database is connected.' }, 503) };
  const exists = module === BUILT_IN_MODULE.slug || Boolean(await store.getModule(module));
  if (!exists) return { error: json({ error: 'Module not found.' }, 404) };
  return { store, by: a.by };
};

export const GET: APIRoute = async ({ cookies, url }) => {
  const module = url.searchParams.get('module') ?? '';
  const g = await guard(cookies, module);
  if (g.error) return g.error;
  try { return json({ banners: await g.store.listBanners(module) }); }
  catch (error) { console.error('[platform] list banners failed', error); return json({ error: 'Could not load banners.' }, 500); }
};

export const POST: APIRoute = async ({ cookies, request, url }) => {
  const module = url.searchParams.get('module') ?? '';
  const g = await guard(cookies, module);
  if (g.error) return g.error;
  const parsed = parseModuleBanner(await request.json().catch(() => ({})));
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  try {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    return json({ banner: await g.store.createBanner(id, module, parsed.value, g.by) }, 201);
  } catch (error) { console.error('[platform] create banner failed', error); return json({ error: 'Could not create the banner.' }, 500); }
};

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  const module = url.searchParams.get('module') ?? '';
  const id = url.searchParams.get('id') ?? '';
  const g = await guard(cookies, module);
  if (g.error) return g.error;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (typeof body.published === 'boolean') {
      const banner = await g.store.publishBanner(module, id, body.published);
      return banner ? json({ banner }) : json({ error: 'Banner not found.' }, 404);
    }
    const parsed = parseModuleBanner(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const banner = await g.store.updateBanner(module, id, parsed.value);
    return banner ? json({ banner }) : json({ error: 'Banner not found.' }, 404);
  } catch (error) { console.error('[platform] update banner failed', error); return json({ error: 'Could not update the banner.' }, 500); }
};

export const DELETE: APIRoute = async ({ cookies, url }) => {
  const module = url.searchParams.get('module') ?? '';
  const g = await guard(cookies, module);
  if (g.error) return g.error;
  try { return (await g.store.deleteBanner(module, url.searchParams.get('id') ?? '')) ? json({ ok: true }) : json({ error: 'Banner not found.' }, 404); }
  catch (error) { console.error('[platform] delete banner failed', error); return json({ error: 'Could not delete the banner.' }, 500); }
};
