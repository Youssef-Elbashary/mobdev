/**
 * The catalogue (permission `platform.settings`; the super admin always has it):
 *   GET                                         { settings, modules: [{ slug, title, builtIn, audience }] }
 *   PUT    { categories, years, specializations, activeSemester, specFromYear, specFromSemester, renames? }
 *          renames: { years?: {old: new}, specializations?: {old: new} } carries a rename into every module and profile
 *   PATCH  ?module=… { category, years[], semester, specializations[], open }   one module's audience
 */
import type { APIRoute } from 'astro';
import { json } from '@/lib/progress/server';
import { access } from '@/lib/accounts/access';
import { listOf, parseSettings } from '@/lib/accounts/core';
import { getAccountStore } from '@/lib/accounts/server';
import { compileModule, orderFlow } from '@/lib/platform/core';
import { BUILT_IN_MODULE, getPlatformStore } from '@/lib/platform/server';

export const prerender = false;

async function guard(cookies: Parameters<typeof access>[0]) {
  const store = getAccountStore();
  if (!store) return { error: json({ error: 'Accounts need a database.' }, 503) };
  if (!(await access(cookies)).can('platform.settings')) return { error: json({ error: 'You do not manage the catalogue.' }, 403) };
  return { store, platform: getPlatformStore() };
}

const audienceOf = (meta: Record<string, string>) => ({
  category: meta.category || 'Core', years: listOf(meta.years), semester: meta.semester || 'Semester 1',
  specializations: listOf(meta.specializations), open: meta.open === 'Yes',
});

export const GET: APIRoute = async ({ cookies }) => {
  const g = await guard(cookies);
  if ('error' in g) return g.error;
  const settings = await g.store.getSettings();
  const rows = (await g.platform?.listModules().catch(() => [])) ?? [];
  return json({
    settings,
    modules: [
      { slug: BUILT_IN_MODULE.slug, title: BUILT_IN_MODULE.title, code: BUILT_IN_MODULE.code, color: BUILT_IN_MODULE.color, builtIn: true, published: true,
        audience: { category: settings.builtIn.category, years: listOf(settings.builtIn.years), semester: settings.builtIn.semester, specializations: listOf(settings.builtIn.specializations), open: settings.builtIn.open !== false } },
      ...rows.map((m) => { const meta = compileModule(m.flow).meta; return { slug: m.slug, title: meta.title || m.title, code: meta.code ?? '', color: meta.color || '#7cb1ff', builtIn: false, published: m.published, audience: audienceOf(meta) }; }),
    ],
  });
};

export const PUT: APIRoute = async ({ cookies, request }) => {
  const g = await guard(cookies);
  if ('error' in g) return g.error;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const s = parseSettings(body);
  if (!s.ok) return json({ error: s.error }, 400);
  try {
    const renames = (body.renames ?? {}) as { years?: Record<string, string>; specializations?: Record<string, string> };
    const mapList = (list: string, map: Record<string, string> = {}) => listOf(list).map((v) => map[v] ?? v).join(', ');
    const anyRename = Object.keys(renames.years ?? {}).length + Object.keys(renames.specializations ?? {}).length > 0;
    if (anyRename) {
      for (const [from, to] of Object.entries(renames.years ?? {})) await g.store.renameProfiles('year', from, to);
      for (const [from, to] of Object.entries(renames.specializations ?? {})) await g.store.renameProfiles('specialization', from, to);
      // builder modules
      for (const m of (await g.platform?.listModules()) ?? []) {
        const root = m.flow.nodes.find((n) => n.type === 'module');
        if (!root) continue;
        root.data.years = mapList(root.data.years ?? '', renames.years);
        root.data.specializations = mapList(root.data.specializations ?? '', renames.specializations);
        await g.platform!.saveModule(m.slug, { flow: m.flow });
      }
      // the built-in course
      const cur = await g.store.getSettings();
      await g.store.setSetting('builtIn', { ...cur.builtIn, years: mapList(cur.builtIn.years, renames.years), specializations: mapList(cur.builtIn.specializations, renames.specializations) });
    }
    await Promise.all([
      g.store.setSetting('categories', s.value.categories), g.store.setSetting('years', s.value.years),
      g.store.setSetting('specializations', s.value.specializations), g.store.setSetting('activeSemester', s.value.activeSemester),
      g.store.setSetting('specFrom', s.value.specFrom),
    ]);
    return json({ settings: await g.store.getSettings() });
  } catch (error) {
    console.error('[catalogue] save failed', error);
    return json({ error: 'Could not save the catalogue.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  const g = await guard(cookies);
  if ('error' in g) return g.error;
  const module = url.searchParams.get('module') ?? '';
  const b = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const settings = await g.store.getSettings();
  const category = String(b.category ?? '').trim();
  if (!settings.categories.some((c) => c.name === category)) return json({ error: 'Choose one of the catalogue’s categories.' }, 400);
  const pick = (v: unknown, allowed: string[]) => (Array.isArray(v) ? v.map(String).filter((x) => allowed.includes(x)) : []);
  const years = pick(b.years, settings.years), specializations = pick(b.specializations, settings.specializations);
  const semester = ['Semester 1', 'Semester 2', 'Both'].includes(String(b.semester)) ? String(b.semester) : 'Semester 1';
  const open = b.open === true;
  try {
    if (module === BUILT_IN_MODULE.slug) {
      await g.store.setSetting('builtIn', { ...settings.builtIn, category, years: years.join(', '), specializations: specializations.join(', '), semester, open });
      return json({ ok: true });
    }
    const m = await g.platform?.getModule(module);
    if (!m) return json({ error: 'Module not found.' }, 404);
    const root = orderFlow(m.flow, 'module')[0];
    if (!root) return json({ error: 'This module has no Module node.' }, 400);
    Object.assign(root.data, { category, years: years.join(', '), specializations: specializations.join(', '), semester, open: open ? 'Yes' : 'No' });
    await g.platform!.saveModule(module, { flow: m.flow });
    return json({ ok: true });
  } catch (error) {
    console.error('[catalogue] module save failed', error);
    return json({ error: 'Could not save.' }, 500);
  }
};
