/**
 * PROGRESS TRACKING — core rules.
 * Pure TypeScript with no framework imports, so it runs in Astro, on Vercel and
 * directly under `node --test` (see tests/progress.test.ts).
 */
import { parseLabOutline } from '../lab.ts';

/* ---------------------------------------------------------------- types */

export type Identity = { name: string; studentId: string; deviceKey: string };
export type LabStructure = {
  lab: string;
  title: string;
  tasks: { n: string; title: string }[];
  exercises: { id: string; task: string; title: string; checks: number }[];
  hasSubmission: boolean;
};
export type AttemptIn = Identity & { lab: string; exercise: string; passed: number; total: number; code: string };
export type TaskIn = Identity & { lab: string; task: string; done: boolean };
export type SubmissionIn = Identity & { lab: string; url: string };
export type Valid<T> = { ok: true; value: T & { studentKey: string } } | { ok: false; errors: Record<string, string> };
/** A student's best result on one exercise. */
export type Best = { exercise: string; passed: number; total: number; attempts: number; firstAt: string; solvedAt: string | null };

/* ----------------------------------------------------------- validation */

// same rules as attendance: letters (any language) + spaces, apostrophes, dots and hyphens
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*[\p{L}\p{M}.]$/u;
const ID_RE = /^[A-Za-z0-9-]{3,20}$/;
const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;
const REPO_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
export const MAX_CODE = 20_000;

const obj = (input: unknown) => (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function validateIdentity(input: unknown): Valid<Identity> {
  const o = obj(input);
  const name = String(o.name ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const studentId = String(o.studentId ?? '').trim();
  const deviceKey = String(o.deviceKey ?? '').trim();
  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) errors.name = 'Please type your full name (letters only).';
  if (!ID_RE.test(studentId)) errors.studentId = 'Your student ID should be 3–20 letters or numbers.';
  if (!DEVICE_RE.test(deviceKey)) errors.deviceKey = 'This browser could not be identified. Refresh the page and try again.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, studentId, deviceKey, studentKey: studentId.toLowerCase() } };
}

/** Identity + lab checks shared by every student write. */
function withLab<T>(input: unknown, labs: LabStructure[], check: (o: Record<string, unknown>, lab: LabStructure, errors: Record<string, string>) => T): Valid<Identity & { lab: string } & T> {
  const o = obj(input);
  const id = validateIdentity(o);
  const errors: Record<string, string> = id.ok ? {} : { ...id.errors };
  const lab = labs.find((l) => l.lab === o.lab);
  if (!lab) errors.lab = 'Unknown lab.';
  const extra = lab ? check(o, lab, errors) : ({} as T);
  if (!id.ok || Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { ...id.value, lab: lab!.lab, ...extra } };
}

export function validateAttempt(input: unknown, labs: LabStructure[]): Valid<AttemptIn> {
  return withLab(input, labs, (o, lab, errors) => {
    const exercise = String(o.exercise ?? '');
    const { passed, total } = o;
    const code = typeof o.code === 'string' ? o.code : '';
    if (!lab.exercises.some((e) => e.id === exercise)) errors.exercise = 'Unknown exercise.';
    if (!isInt(passed) || !isInt(total) || total < 1 || total > 50 || passed < 0 || passed > total) errors.score = 'Invalid score.';
    if (code.length > MAX_CODE) errors.code = 'The code is too long to save.';
    return { exercise, passed: passed as number, total: total as number, code };
  });
}

export function validateTask(input: unknown, labs: LabStructure[]): Valid<TaskIn> {
  return withLab(input, labs, (o, lab, errors) => {
    const task = String(o.task ?? '');
    if (!lab.tasks.some((t) => t.n === task)) errors.task = 'Unknown task.';
    if (typeof o.done !== 'boolean') errors.done = 'Invalid value.';
    return { task, done: o.done === true };
  });
}

export function validateSubmission(input: unknown, labs: LabStructure[]): Valid<SubmissionIn> {
  return withLab(input, labs, (o, lab, errors) => {
    const url = String(o.url ?? '').trim();
    if (!lab.hasSubmission) errors.lab = 'This lab has no repository to submit.';
    else if (!REPO_RE.test(url)) errors.url = 'Paste the link to your repository, like https://github.com/your-username/movies-app';
    return { url: url.replace(/\/$/, '') };
  });
}

/* ------------------------------------------------------------ device lock */

/** One student ID belongs to one browser until the admin unlocks it. */
export function decideLock(existing: { device_key: string | null } | null, deviceKey: string): 'create' | 'ok' | 'relock' | 'conflict' {
  if (!existing) return 'create';
  if (existing.device_key === deviceKey) return 'ok';
  if (existing.device_key === null) return 'relock';
  return 'conflict';
}

/* ---------------------------------------------------------- lab structure */

const attr = (src: string, name: string) => src.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

/** Tasks come from <Task>, exercises from <Playground ex="…"> (not `demo`) inside them. */
export function labStructure(lab: string, title: string, body: string, info: (id: string) => { title: string; checks: number } | null): LabStructure {
  const tasks = parseLabOutline(body).flatMap((p) => p.tasks.map((t) => ({ n: t.n, title: t.title })));
  const exercises: LabStructure['exercises'] = [];
  let task = '';
  for (const m of body.matchAll(/<(Task|Playground)\b([^>]*)>/g)) {
    const [, kind, attrs] = m;
    if (kind === 'Task') task = attr(attrs, 'n') ?? '';
    else if (!/\bdemo\b/.test(attrs)) {
      const id = attr(attrs, 'ex');
      const meta = id ? info(id) : null;
      if (id && meta && meta.checks > 0) exercises.push({ id, task, title: meta.title, checks: meta.checks });
    }
  }
  return { lab, title, tasks, exercises, hasSubmission: /<RepoSubmit\b/.test(body) };
}

/* ---------------------------------------------------------------- scoring */

/** exercises 70 · tasks 20 · repo 10 (75/25 without a repo; tasks only without exercises). */
export function scoreStudent(s: LabStructure, best: Best[], doneTasks: number, submitted: boolean): { percent: number; solved: number } {
  const ids = new Set(s.exercises.map((e) => e.id));
  const mine = best.filter((b) => ids.has(b.exercise));
  const solved = mine.filter((b) => b.total > 0 && b.passed >= b.total).length;
  const ex = s.exercises.length ? mine.reduce((a, b) => a + Math.min(1, b.total ? b.passed / b.total : 0), 0) / s.exercises.length : 0;
  const tasks = s.tasks.length ? Math.min(1, doneTasks / s.tasks.length) : 0;
  const sub = submitted ? 1 : 0;
  const hasEx = s.exercises.length > 0;
  const [we, wt, ws] = hasEx ? (s.hasSubmission ? [70, 20, 10] : [75, 25, 0]) : s.hasSubmission ? [0, 80, 20] : [0, 100, 0];
  return { percent: Math.round(we * ex + wt * tasks + ws * sub), solved };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Class view per exercise. `bestByStudent` has one array per active student. */
export function exerciseStats(s: LabStructure, bestByStudent: Best[][]) {
  return s.exercises.map((e) => {
    const rows = bestByStudent.map((bs) => bs.find((b) => b.exercise === e.id)).filter(Boolean) as Best[];
    const solvers = rows.filter((b) => b.passed >= b.total && b.solvedAt);
    const attempts = rows.map((b) => b.attempts);
    return {
      id: e.id,
      solvedPct: bestByStudent.length ? Math.round((100 * solvers.length) / bestByStudent.length) : 0,
      avgAttempts: attempts.length ? Math.round((attempts.reduce((a, b) => a + b, 0) / attempts.length) * 10) / 10 : 0,
      medianSolveMs: median(solvers.map((b) => Date.parse(b.solvedAt!) - Date.parse(b.firstAt))),
    };
  });
}

/* -------------------------------------------------------------------- CSV */

export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
