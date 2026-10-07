/** GET /api/cms/history — recent CMS saves (who, what, when). */
import type { APIRoute } from 'astro';
import { errorResponse, guard, json } from '@/lib/cms/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const g = await guard(cookies);
  if (g instanceof Response) return g;
  try {
    return json({ items: await g.repo.history(30) });
  } catch (e) {
    return errorResponse(e);
  }
};
