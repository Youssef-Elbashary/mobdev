/**
 * PROGRESS TRACKING — server glue (Astro + Vercel). Rules live in ./core.ts, storage in ./store.ts.
 *
 * Needs, in Vercel → Project → Storage: a Neon database connected to the project
 * (it adds DATABASE_URL). Previews and laptops use the progress_dev_* tables, production progress_*.
 * On a laptop without DATABASE_URL an in-memory store is used (it resets when the dev server restarts).
 */
import { getSecret } from 'astro:env/server';
import { getCollection } from 'astro:content';
import { getPlayground } from '@/lib/playgrounds';
import { noStore } from '@/lib/attendance/server';
import { labStructure, type LabStructure, type Valid } from './core';
import { MemoryStore, NeonStore, type ProgressStore } from './store';

const env = (key: string) => getSecret(key) || undefined;
const onVercel = () => Boolean(env('VERCEL'));
const databaseUrl = () => env('DATABASE_URL') ?? env('POSTGRES_URL');

let store: ProgressStore | null | undefined;

/** The progress store, or null when a deployment has no database yet. */
export function getProgressStore(): ProgressStore | null {
  if (store !== undefined) return store;
  const url = databaseUrl();
  if (url) store = new NeonStore(url, env('VERCEL_ENV') === 'production' ? 'progress' : 'progress_dev');
  else store = onVercel() ? null : new MemoryStore();
  return store;
}

export const progressSetup = () => ({ database: Boolean(databaseUrl()) || !onVercel() });

/* ---------------------------------------------------------- lab structure */

let structures: Promise<LabStructure[]> | null = null;

/** Every lab's tasks and auto-checked exercises, read from the lab content. */
export function getStructures(): Promise<LabStructure[]> {
  if (structures && onVercel()) return structures;
  structures = (async () => {
    const labs = (await getCollection('labs', (e) => !e.data.draft)).sort((a, b) => a.data.number - b.data.number);
    return labs.map((lab) =>
      labStructure(lab.id, `Lab ${String(lab.data.number).padStart(2, '0')}: ${lab.data.title}`, lab.body ?? '', (id) => {
        try {
          const p = getPlayground(id);
          return { title: p.title, checks: p.checks.length };
        } catch {
          return null;
        }
      }),
    );
  })();
  return structures;
}

/* --------------------------------------------------------------- responses */

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...noStore } });

const WRITES_PER_WINDOW = 120;
const WINDOW_SEC = 10 * 60;

/** Shared flow of every student write: validate → rate limit → device lock → store. */
export async function studentWrite<T extends { studentKey: string; name: string; studentId: string; deviceKey: string }>(
  request: Request,
  validate: (body: unknown, labs: LabStructure[]) => Valid<T>,
  act: (store: ProgressStore, value: T) => Promise<void>,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad-request' }, 400);
  }
  const v = validate(body, await getStructures());
  if (!v.ok) return json({ error: 'invalid', errors: v.errors }, 400);

  const s = getProgressStore();
  if (!s) return json({ error: 'closed', message: 'Progress tracking is not set up yet.' }, 503);
  try {
    if ((await s.hit(`w:${v.value.deviceKey}`, WINDOW_SEC)) > WRITES_PER_WINDOW) return json({ error: 'slow-down' }, 429);
    if ((await s.touchStudent(v.value)) === 'conflict') {
      return json({ error: 'device', message: 'This student ID is already used on another device. Ask your TA to unlock it.' }, 409);
    }
    await act(s, v.value);
    return json({ ok: true });
  } catch (err) {
    console.error('[progress] write failed', err);
    return json({ error: 'server' }, 500);
  }
}
