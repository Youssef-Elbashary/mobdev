/** GET /api/progress/session?lab=lab-02 — is check-in open for this lab? { open, closesAt } (public). */
import type { APIRoute } from 'astro';
import { sessionState } from '@/lib/progress/core';
import { getProgressStore, json } from '@/lib/progress/server';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const store = getProgressStore();
  const lab = url.searchParams.get('lab') ?? '';
  if (!store || !lab) return json({ open: false, closesAt: null });
  try {
    return json(sessionState(await store.getSession(lab), Date.now()));
  } catch (err) {
    console.error('[progress] session failed', err);
    return json({ open: false, closesAt: null, error: 'server' }, 500);
  }
};
