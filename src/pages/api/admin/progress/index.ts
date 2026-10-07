/** GET /api/admin/progress?lab=lab-02 — the live dashboard data (admin only). */
import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/attendance/server';
import { access } from '@/lib/accounts/access';
import { canOnLab, canSeeLab } from '@/lib/accounts/labscope';
import { buildDashboard, json, progressSetup } from '@/lib/progress/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return json({ error: 'unauthorised' }, 401);
  if (!progressSetup().database) return json({ error: 'no-database' }, 503);
  try {
    const a = await access(cookies);
    const data = await buildDashboard(url.searchParams.get('lab'), url.searchParams.get('session'), (lab) => canSeeLab(a, lab));
    return data ? json(data) : json({ error: 'no-labs' }, 404);
  } catch (err) {
    console.error('[progress] dashboard failed', err);
    return json({ error: 'server' }, 500);
  }
};
