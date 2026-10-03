/**
 * GET /api/attendance/status — is attendance ready? Read-only; never writes and never reveals names.
 * { open, database: 'connected' | 'missing' | 'error', password }
 */
import type { APIRoute } from 'astro';
import { getStore, noStore, setupStatus } from '@/lib/attendance/server';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { password } = setupStatus();
  const store = getStore();
  let database: 'connected' | 'missing' | 'error' = store ? 'connected' : 'missing';
  if (store) {
    try {
      await store.count();
    } catch (err) {
      console.error('[attendance] status check failed', err);
      database = 'error';
    }
  }
  return new Response(JSON.stringify({ open: database === 'connected' && password, database, password }), {
    headers: { 'content-type': 'application/json', ...noStore },
  });
};
