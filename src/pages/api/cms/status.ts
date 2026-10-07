/** GET /api/cms/status — unpublished changes, preview link, mode. */
import type { APIRoute } from 'astro';
import { errorResponse, guard, json } from '@/lib/cms/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const g = await guard(cookies);
  if (g instanceof Response) return g;
  try {
    return json({ editor: g.editor, ...(await g.repo.status()) });
  } catch (e) {
    return errorResponse(e);
  }
};
