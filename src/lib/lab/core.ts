/**
 * INTERACTIVE LAB PROGRESS — core logic (pure TypeScript; tested by tests/lab-progress.test.ts).
 * Students' browsers send events (start / check / hint); /admin reads aggregated stats.
 */
import { validateCheckIn } from '../attendance/core.ts';
import { EXERCISES as LAB02_EXERCISES, FINAL_ID as LAB02_FINAL } from '../../lab/exercises/lab-02/meta.ts';

export type LabExercise = { id: string; n: number; title: string; block: number };
export const LABS: Record<string, { exercises: LabExercise[]; final: string }> = {
  'lab-02': { exercises: LAB02_EXERCISES, final: LAB02_FINAL },
};

export type LabEventKind = 'start' | 'check' | 'hint';
export type CheckResult = 'pass' | 'partial' | 'fail';
export type LabEvent = {
  lab: string;
  sessionId: string;
  group: string;
  name: string;
  studentId: string;
  /** lower-case student ID — one row per student per lab, even across devices */
  studentKey: string;
  deviceId: string;
  event: LabEventKind;
  exercise: string | null;
  result: CheckResult | null;
  score: number | null;
};

/**
 * `known` lists every other lab that exists (file-based and builder labs): they may record a `start`
 * (the session gate binds the student to the session); check/hint events need an interactive definition.
 */
export function validateLabEvent(body: unknown, known: (lab: string) => boolean = () => false): { ok: true; event: LabEvent } | { ok: false; error: string } {
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const lab = String(o.lab ?? '');
  const def = LABS[lab] ?? (known(lab) ? { exercises: [], final: '' } : null);
  if (!def) return { ok: false, error: 'Unknown lab.' };
  const who = validateCheckIn({ name: o.name, studentId: o.studentId, deviceId: o.deviceId });
  if (!who.ok) return { ok: false, error: Object.values(who.errors)[0] ?? 'Invalid student.' };
  const rawSessionId = String(o.sessionId ?? '').trim();
  const rawGroup = String(o.group ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  // Legacy defaults keep the pure core/backend usable for old data and unit tests.
  // The HTTP endpoint still requires a real, currently-open session ID.
  const sessionId = rawSessionId || 'legacy';
  const group = rawGroup || '—';
  if (rawSessionId && !/^s_[A-Za-z0-9_]{6,80}$/.test(rawSessionId)) return { ok: false, error: 'This lab session is not available. Refresh the page.' };
  if (rawGroup && (rawGroup.length > 30 || !/^[\p{L}\p{M}\p{N} ._/-]+$/u.test(rawGroup))) return { ok: false, error: 'Enter your group (for example, G1).' };
  const event = String(o.event ?? '') as LabEventKind;
  if (!['start', 'check', 'hint'].includes(event)) return { ok: false, error: 'Unknown event.' };
  let exercise: string | null = null;
  let result: CheckResult | null = null;
  let score: number | null = null;
  if (event !== 'start') {
    exercise = String(o.exercise ?? '');
    if (!def.exercises.some((e) => e.id === exercise)) return { ok: false, error: 'Unknown exercise.' };
  }
  if (event === 'check') {
    result = String(o.result ?? '') as CheckResult;
    if (!['pass', 'partial', 'fail'].includes(result)) return { ok: false, error: 'Unknown result.' };
    const s = Number(o.score);
    score = Number.isFinite(s) ? Math.min(1, Math.max(0, s)) : result === 'pass' ? 1 : 0;
    if (result === 'pass') score = 1;
  }
  return {
    ok: true,
    event: { lab, sessionId, group, name: who.name, studentId: who.studentId, studentKey: who.studentId.toLowerCase(), deviceId: who.deviceId, event, exercise, result, score },
  };
}

/* ------------------------------------------------------------ storage rows */

export type StudentRow = {
  student_key: string;
  student_id: string;
  name: string;
  started_at: string;
  last_seen: string;
  completed_at: string | null;
  /** End-of-lab attendance card; absent in legacy/dedicated backends. */
  checked_in_at?: string | null;
};
export type AttemptRow = { student_key: string; exercise: string; attempts: number; hints: number; best_score: number; solved_at: string | null };

export interface LabBackend {
  record(event: LabEvent): Promise<void>;
  rows(lab: string, sessionId?: string): Promise<{ students: StudentRow[]; attempts: AttemptRow[] }>;
  /** rate limiting: count of hits for this key in the current window */
  hit(key: string, windowSec: number): Promise<number>;
}

/** Same rules as supabase/lab-progress.sql, in memory (local dev and tests). */
export class MemoryLabBackend implements LabBackend {
  private students = new Map<string, StudentRow & { lab: string }>();
  private attempts = new Map<string, AttemptRow & { lab: string }>();
  private hits = new Map<string, { n: number; until: number }>();
  private now: () => Date;
  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  async record(e: LabEvent) {
    const at = this.now().toISOString();
    const sk = `${e.lab}|${e.studentKey}`;
    const prev = this.students.get(sk);
    this.students.set(sk, {
      lab: e.lab,
      student_key: e.studentKey,
      student_id: e.studentId,
      name: e.name,
      started_at: prev?.started_at ?? at,
      last_seen: at,
      completed_at: prev?.completed_at ?? null,
    });
    if (!e.exercise || e.event === 'start') return;
    const ak = `${sk}|${e.exercise}`;
    const a = this.attempts.get(ak) ?? { lab: e.lab, student_key: e.studentKey, exercise: e.exercise, attempts: 0, hints: 0, best_score: 0, solved_at: null };
    if (e.event === 'check') a.attempts += 1;
    if (e.event === 'hint') a.hints += 1;
    a.best_score = Math.max(a.best_score, e.score ?? 0);
    if (e.result === 'pass' && !a.solved_at) a.solved_at = at;
    this.attempts.set(ak, a);
    if (e.result === 'pass' && e.exercise === LABS[e.lab]?.final) {
      const s = this.students.get(sk)!;
      s.completed_at = s.completed_at ?? at;
    }
  }

  async rows(lab: string) {
    return {
      students: [...this.students.values()].filter((s) => s.lab === lab).map(({ lab: _, ...s }) => s),
      attempts: [...this.attempts.values()].filter((a) => a.lab === lab).map(({ lab: _, ...a }) => a),
    };
  }

  async hit(key: string, windowSec: number) {
    const now = this.now().getTime();
    const h = this.hits.get(key);
    const next = !h || h.until < now ? { n: 1, until: now + windowSec * 1000 } : { n: h.n + 1, until: h.until };
    this.hits.set(key, next);
    return next.n;
  }
}

/* ------------------------------------------------------------- statistics */

export type ExerciseStats = {
  id: string;
  n: number;
  title: string;
  block: number;
  attempted: number;
  solved: number;
  notSolved: number;
  /** solved / attempted (null when nobody attempted yet) */
  successRate: number | null;
  avgAttempts: number | null;
  hints: number;
};
export type StudentStats = {
  name: string;
  studentId: string;
  startedAt: string;
  solved: number;
  pct: number;
  completed: boolean;
  minutes: number;
  lastSeen: string;
  checkedInAt: string | null;
  active: boolean;
  /** per exercise id: solved | trying | new */
  states: Record<string, 'solved' | 'trying' | 'new'>;
};
export type LabStats = {
  lab: string;
  generatedAt: string;
  totals: { started: number; completed: number; active: number; avgCompletion: number; avgMinutesToComplete: number | null };
  exercises: ExerciseStats[];
  hardest: string[];
  students: StudentStats[];
};

const ACTIVE_MS = 2 * 60 * 1000;
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function aggregate(lab: string, students: StudentRow[], attempts: AttemptRow[], now = Date.now()): LabStats {
  const def = LABS[lab];
  const exercises = def?.exercises ?? [];
  const byStudent = new Map<string, AttemptRow[]>();
  for (const a of attempts) byStudent.set(a.student_key, [...(byStudent.get(a.student_key) ?? []), a]);

  const exStats: ExerciseStats[] = exercises.map((ex) => {
    const rows = attempts.filter((a) => a.exercise === ex.id);
    const tried = rows.filter((a) => a.attempts > 0 || a.solved_at);
    const solved = rows.filter((a) => a.solved_at).length;
    return {
      id: ex.id,
      n: ex.n,
      title: ex.title,
      block: ex.block,
      attempted: tried.length,
      solved,
      notSolved: tried.length - solved,
      successRate: tried.length ? round(solved / tried.length) : null,
      avgAttempts: tried.length ? round(tried.reduce((s, a) => s + a.attempts, 0) / tried.length, 1) : null,
      hints: rows.reduce((s, a) => s + a.hints, 0),
    };
  });

  const maxTried = Math.max(0, ...exStats.map((e) => e.attempted));
  const minTried = Math.min(3, maxTried);
  const hardest = exStats
    .filter((e) => e.attempted > 0 && e.attempted >= minTried && (e.successRate ?? 1) < 1)
    .sort((a, b) => (a.successRate ?? 1) - (b.successRate ?? 1) || (b.avgAttempts ?? 0) - (a.avgAttempts ?? 0))
    .slice(0, 3)
    .map((e) => e.id);

  const studentStats: StudentStats[] = students
    .map((s) => {
      const rows = byStudent.get(s.student_key) ?? [];
      const states: StudentStats['states'] = {};
      for (const ex of exercises) {
        const r = rows.find((a) => a.exercise === ex.id);
        states[ex.id] = r?.solved_at ? 'solved' : r && (r.attempts > 0 || r.hints > 0) ? 'trying' : 'new';
      }
      const solved = Object.values(states).filter((v) => v === 'solved').length;
      const start = Date.parse(s.started_at);
      const end = s.completed_at ? Date.parse(s.completed_at) : Date.parse(s.last_seen);
      return {
        name: s.name,
        studentId: s.student_id,
        startedAt: s.started_at,
        solved,
        pct: exercises.length ? round(solved / exercises.length) : 0,
        completed: !!s.completed_at,
        minutes: Math.max(0, Math.round((end - start) / 60000)),
        lastSeen: s.last_seen,
        checkedInAt: s.checked_in_at ?? null,
        active: now - Date.parse(s.last_seen) < ACTIVE_MS,
        states,
      };
    })
    .sort((a, b) => b.solved - a.solved || a.name.localeCompare(b.name));

  const completed = studentStats.filter((s) => s.completed);
  return {
    lab,
    generatedAt: new Date(now).toISOString(),
    totals: {
      started: studentStats.length,
      completed: completed.length,
      active: studentStats.filter((s) => s.active).length,
      avgCompletion: studentStats.length ? round(studentStats.reduce((s, x) => s + x.pct, 0) / studentStats.length) : 0,
      avgMinutesToComplete: completed.length ? Math.round(completed.reduce((s, x) => s + x.minutes, 0) / completed.length) : null,
    },
    exercises: exStats,
    hardest,
    students: studentStats,
  };
}
