/** POST /api/cms/publish — merge the drafts into main (goes live after Vercel's build). */
import type { APIRoute } from 'astro';
import { errorResponse, guard, json } from '@/lib/cms/server';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const g = guard(cookies);
  if (g instanceof Response) return g;
  try {
    const r = await g.repo.publish();
    if ('conflict' in r) return json({ error: 'conflict', message: 'Someone changed the same file on main. Resolve it in the pull request.', prUrl: r.prUrl }, 409);
    return json({ ok: true, prUrl: r.prUrl });
  } catch (e) {
    return errorResponse(e);
  }
};
