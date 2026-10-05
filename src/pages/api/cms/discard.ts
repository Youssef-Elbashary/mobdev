/** POST /api/cms/discard — throw away all unpublished changes. */
import type { APIRoute } from 'astro';
import { errorResponse, guard, json } from '@/lib/cms/server';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const g = guard(cookies);
  if (g instanceof Response) return g;
  try {
    await g.repo.discard();
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
};
