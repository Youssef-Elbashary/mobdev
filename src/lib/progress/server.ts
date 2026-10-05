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
import { EXERCISES as LAB02_EXERCISES } from '@/lab/exercises/lab-02/meta';
import { noStore } from '@/lib/attendance/server';
import { exerciseStats, labStructure, scoreStudent, sessionState, type Identity, type LabStructure, type Valid } from './core';
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
          const exercise = lab.id === 'lab-02' ? LAB02_EXERCISES.find((item) => item.id === id) : null;
          return exercise ? { title: exercise.title, checks: 1, task: String(exercise.block) } : null;
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

/**
 * Shared flow of every student write: validate → rate limit → device lock → store.
 * `act` may return a Response (sent as is) or extra fields for the JSON answer.
 */
export async function studentWrite<V extends Identity>(
  request: Request,
  validate: (body: unknown, labs: LabStructure[]) => Valid<V>,
  act: (store: ProgressStore, value: V & { studentKey: string }) => Promise<Response | Record<string, unknown> | void>,
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
      return json({ error: 'device', message: 'This browser is linked to another student, or this student ID is linked to another device. Ask your TA to use “Allow new device”.' }, 409);
    }
    const out = await act(s, v.value);
    return out instanceof Response ? out : json({ ok: true, ...(out ?? {}) });
  } catch (err) {
    console.error('[progress] write failed', err);
    return json({ error: 'server' }, 500);
  }
}

/* --------------------------------------------------------------- dashboard */

export type DashboardStudent = {
  key: string;
  id: string;
  name: string;
  lastSeen: string;
  locked: boolean;
  percent: number;
  solved: number;
  tasksDone: number;
  submission: { url: string; reviewed: boolean; note: string } | null;
  cells: Record<string, { passed: number; total: number; attempts: number }>;
  /** end-of-lab check-in time, or null */
  attended: string | null;
  /** tasks that were on screen long enough */
  seen: number;
  activeSec: number;
};

/** Everything /admin/progress shows for one lab. */
export async function buildDashboard(labParam: string | null) {
  const labs = await getStructures();
  const structure = labs.find((l) => l.lab === labParam) ?? labs.find((l) => l.exercises.length) ?? labs[0];
  const s = getProgressStore();
  if (!structure || !s) return null;
  const data = await s.labData(structure.lab);
  const students: DashboardStudent[] = data.students.map((st) => {
    const best = data.best.filter((b) => b.student_key === st.student_key);
    const tasksDone = data.tasks.find((t) => t.student_key === st.student_key)?.done ?? 0;
    const sub = data.submissions.find((x) => x.student_key === st.student_key) ?? null;
    const score = scoreStudent(structure, best, tasksDone, Boolean(sub));
    const view = data.views.find((v) => v.student_key === st.student_key);
    return {
      attended: data.checkins.find((c) => c.student_key === st.student_key)?.at ?? null,
      seen: view?.seen.length ?? 0,
      activeSec: view?.active_sec ?? 0,
      key: st.student_key,
      id: st.student_id,
      name: st.name,
      lastSeen: st.last_seen,
      locked: st.device_key !== null,
      percent: score.percent,
      solved: score.solved,
      tasksDone,
      submission: sub && { url: sub.url, reviewed: sub.reviewed, note: sub.note },
      cells: Object.fromEntries(best.map((b) => [b.exercise, { passed: b.passed, total: b.total, attempts: b.attempts }])),
    };
  });
  students.sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
  const exercises = exerciseStats(structure, data.students.map((st) => data.best.filter((b) => b.student_key === st.student_key)));
  return {
    labs: labs.map((l) => ({ id: l.lab, title: l.title })),
    structure,
    students,
    exercises,
    totals: {
      active: students.length,
      avgPercent: students.length ? Math.round(students.reduce((a, b) => a + b.percent, 0) / students.length) : 0,
      solved: students.reduce((a, b) => a + b.solved, 0),
      submitted: students.filter((x) => x.submission).length,
      checkedIn: students.filter((x) => x.attended).length,
    },
    session: sessionState(await s.getSession(structure.lab), Date.now()),
    updatedAt: new Date().toISOString(),
  };
}
