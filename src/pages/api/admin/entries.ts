/** GET /api/admin/entries?from=N — check-ins after #N as JSON (fallback when streaming is unavailable). */
import type { APIRoute } from 'astro';
import { getStore, isAdmin, noStore } from '@/lib/attendance/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return new Response('Unauthorized', { status: 401, headers: noStore });
  const store = getStore();
  if (!store) return new Response('Attendance database not connected', { status: 503, headers: noStore });
  const from = Math.max(0, Number(url.searchParams.get('from') ?? 0) || 0);
  const entries = await store.list(from);
  return new Response(JSON.stringify({ entries }), { headers: { 'content-type': 'application/json', ...noStore } });
};
