/** GET /api/progress/session?lab=lab-02 — is check-in open for this lab? { open, closesAt, practice } (public). */
import type { APIRoute } from 'astro';
import { sessionState } from '@/lib/progress/core';
import { getProgressStore, json } from '@/lib/progress/server';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const store = getProgressStore();
  const lab = url.searchParams.get('lab') ?? '';
  if (!store || !lab) return json({ open: false, closesAt: null, practice: false });
  try {
    const now = Date.now();
    const sessions = (await store.listSessions(lab))
      .map((session) => ({ ...session, ...sessionState(session, now) }))
      .filter((session) => session.open);
    const practice = await store.getPractice(lab);
    // Retain the top-level session fields for older clients while exposing every live session.
    return json(sessions[0] ? { ...sessions[0], sessions, practice } : { open: false, closesAt: null, sessions: [], practice });
  } catch (err) {
    console.error('[progress] session failed', err);
    return json({ open: false, closesAt: null, sessions: [], practice: false, error: 'server' }, 500);
  }
};
