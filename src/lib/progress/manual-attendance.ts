import type { ProgressStore } from './store.ts';

/** Staff may correct attendance after a session ends, without changing progress or device identity. */
export async function markPresent(store: ProgressStore, lab: string, sessionId: string, studentKey: string) {
  const session = await store.getSessionById(sessionId);
  if (!session || session.lab !== lab) return null;
  if (!(await store.isSessionStudent(sessionId, studentKey))) return null;
  return store.checkIn(studentKey, lab, sessionId);
}
