/**
 * PROGRESS TRACKING — storage. One interface, two backends:
 *   MemoryStore  laptops without a database, and the unit tests
 *   NeonStore    Neon Postgres (Vercel Marketplace), tables created on first use
 */
import { neon } from '@neondatabase/serverless';
import { decideLock, type Best, type Identity } from './core.ts';

export type StudentRow = { student_key: string; student_id: string; name: string; device_key: string | null; created_at: string; last_seen: string };
export type AttemptRow = { id: number; exercise: string; passed: number; total: number; code: string; created_at: string };
export type SubmissionRow = { student_key: string; url: string; reviewed: boolean; note: string; updated_at: string };
export type LabData = {
  students: StudentRow[];
  best: (Best & { student_key: string })[];
  tasks: { student_key: string; done: number }[];
  submissions: SubmissionRow[];
};
export type StudentData = {
  student: StudentRow | null;
  attempts: AttemptRow[];
  tasks: { task: string; done: boolean }[];
  submission: { url: string; reviewed: boolean; note: string } | null;
};

export interface ProgressStore {
  /** Creates the student, or checks the device lock; refreshes name + last_seen. */
  touchStudent(i: Identity & { studentKey: string }): Promise<'ok' | 'conflict'>;
  addAttempt(a: { studentKey: string; lab: string; exercise: string; passed: number; total: number; code: string }): Promise<void>;
  setTask(t: { studentKey: string; lab: string; task: string; done: boolean }): Promise<void>;
  setSubmission(s: { studentKey: string; lab: string; url: string }): Promise<void>;
  /** Counts calls per key inside a time window (rate limiting). */
  hit(key: string, windowSec: number): Promise<number>;
  labData(lab: string): Promise<LabData>;
  studentData(lab: string, studentKey: string): Promise<StudentData>;
  unlock(studentKey: string): Promise<void>;
  review(studentKey: string, lab: string, reviewed: boolean, note: string): Promise<void>;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

/* ------------------------------------------------------------------ memory */

export class MemoryStore implements ProgressStore {
  private students = new Map<string, StudentRow>();
  private attempts: (AttemptRow & { student_key: string; lab: string })[] = [];
  private tasks = new Map<string, { student_key: string; lab: string; task: string; done: boolean }>();
  private subs = new Map<string, SubmissionRow & { lab: string }>();
  private hits = new Map<string, { n: number; until: number }>();
  private seq = 0;
  private now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
  }
  private stamp = () => new Date(this.now()).toISOString();

  async touchStudent(i: Identity & { studentKey: string }) {
    const row = this.students.get(i.studentKey) ?? null;
    const d = decideLock(row, i.deviceKey);
    if (d === 'conflict') return 'conflict' as const;
    const t = this.stamp();
    this.students.set(i.studentKey, {
      student_key: i.studentKey, student_id: i.studentId, name: i.name, device_key: i.deviceKey,
      created_at: row?.created_at ?? t, last_seen: t,
    });
    return 'ok' as const;
  }
  async addAttempt(a: { studentKey: string; lab: string; exercise: string; passed: number; total: number; code: string }) {
    this.attempts.push({ id: ++this.seq, student_key: a.studentKey, lab: a.lab, exercise: a.exercise, passed: a.passed, total: a.total, code: a.code, created_at: this.stamp() });
  }
  async setTask(t: { studentKey: string; lab: string; task: string; done: boolean }) {
    this.tasks.set(`${t.studentKey}|${t.lab}|${t.task}`, { student_key: t.studentKey, lab: t.lab, task: t.task, done: t.done });
  }
  async setSubmission(s: { studentKey: string; lab: string; url: string }) {
    const k = `${s.studentKey}|${s.lab}`;
    const old = this.subs.get(k);
    this.subs.set(k, { student_key: s.studentKey, lab: s.lab, url: s.url, reviewed: old?.url === s.url ? old.reviewed : false, note: old?.note ?? '', updated_at: this.stamp() });
  }
  async hit(key: string, windowSec: number) {
    const t = this.now();
    const h = this.hits.get(key);
    const next = !h || h.until < t ? { n: 1, until: t + windowSec * 1000 } : { n: h.n + 1, until: h.until };
    this.hits.set(key, next);
    return next.n;
  }
  async labData(lab: string): Promise<LabData> {
    const att = this.attempts.filter((a) => a.lab === lab);
    const tasks = [...this.tasks.values()].filter((t) => t.lab === lab);
    const subs = [...this.subs.values()].filter((s) => s.lab === lab);
    const keys = new Set([...att.map((a) => a.student_key), ...tasks.map((t) => t.student_key), ...subs.map((s) => s.student_key)]);
    const groups = new Map<string, typeof att>();
    for (const a of att) groups.set(`${a.student_key}|${a.exercise}`, [...(groups.get(`${a.student_key}|${a.exercise}`) ?? []), a]);
    const best = [...groups.values()].map((g) => {
      const top = [...g].sort((a, b) => b.passed - a.passed || b.id - a.id)[0];
      const solved = g.filter((a) => a.passed === a.total).map((a) => a.created_at).sort()[0] ?? null;
      return { student_key: top.student_key, exercise: top.exercise, passed: top.passed, total: top.total, attempts: g.length, firstAt: g.map((a) => a.created_at).sort()[0], solvedAt: solved };
    });
    const done = new Map<string, number>();
    for (const t of tasks) done.set(t.student_key, (done.get(t.student_key) ?? 0) + (t.done ? 1 : 0));
    return {
      students: [...keys].map((k) => this.students.get(k)!).filter(Boolean),
      best,
      tasks: [...done].map(([student_key, n]) => ({ student_key, done: n })),
      submissions: subs.map(({ lab: _lab, ...s }) => s),
    };
  }
  async studentData(lab: string, studentKey: string): Promise<StudentData> {
    const sub = this.subs.get(`${studentKey}|${lab}`);
    return {
      student: this.students.get(studentKey) ?? null,
      attempts: this.attempts.filter((a) => a.lab === lab && a.student_key === studentKey).reverse().map(({ student_key: _s, lab: _l, ...a }) => a),
      tasks: [...this.tasks.values()].filter((t) => t.lab === lab && t.student_key === studentKey).map(({ task, done }) => ({ task, done })),
      submission: sub ? { url: sub.url, reviewed: sub.reviewed, note: sub.note } : null,
    };
  }
  async unlock(studentKey: string) {
    const row = this.students.get(studentKey);
    if (row) row.device_key = null;
  }
  async review(studentKey: string, lab: string, reviewed: boolean, note: string) {
    const sub = this.subs.get(`${studentKey}|${lab}`);
    if (sub) Object.assign(sub, { reviewed, note });
  }
}

/* -------------------------------------------------------------------- neon */

type Prefix = 'progress' | 'progress_dev';

export class NeonStore implements ProgressStore {
  private sql: ReturnType<typeof neon>;
  private ready: Promise<void> | null = null;
  private t: { students: string; attempts: string; tasks: string; subs: string; hits: string };

  constructor(url: string, prefix: Prefix) {
    this.sql = neon(url);
    this.t = { students: `${prefix}_students`, attempts: `${prefix}_attempts`, tasks: `${prefix}_tasks`, subs: `${prefix}_submissions`, hits: `${prefix}_hits` };
  }

  private async q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
    await (this.ready ??= this.migrate());
    return (await this.sql.query(text, params)) as T[];
  }

  /** Tables are created on first use (idempotent), so there is no SQL to run by hand. */
  private async migrate() {
    const { students, attempts, tasks, subs, hits } = this.t;
    const statements = [
      `create table if not exists ${students} (
        student_key text primary key, student_id text not null, name text not null, device_key text,
        created_at timestamptz not null default now(), last_seen timestamptz not null default now())`,
      `create table if not exists ${attempts} (
        id bigint generated always as identity primary key,
        student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, exercise text not null, passed int not null, total int not null, code text not null,
        created_at timestamptz not null default now())`,
      `create index if not exists ${attempts}_lab on ${attempts} (lab, student_key, exercise)`,
      `create table if not exists ${tasks} (
        student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, task text not null, done boolean not null, updated_at timestamptz not null default now(),
        primary key (student_key, lab, task))`,
      `create table if not exists ${subs} (
        student_key text not null references ${students}(student_key) on delete cascade,
        lab text not null, url text not null, reviewed boolean not null default false, note text not null default '',
        updated_at timestamptz not null default now(), primary key (student_key, lab))`,
      `create table if not exists ${hits} (key text primary key, n int not null, until timestamptz not null)`,
    ];
    try {
      for (const s of statements) await this.sql.query(s);
    } catch (e) {
      this.ready = null; // try again on the next request
      throw e;
    }
  }

  async touchStudent(i: Identity & { studentKey: string }) {
    const { students } = this.t;
    for (let round = 0; round < 2; round++) {
      const [row] = await this.q<{ device_key: string | null }>(`select device_key from ${students} where student_key = $1`, [i.studentKey]);
      const d = decideLock(row ?? null, i.deviceKey);
      if (d === 'conflict') return 'conflict' as const;
      if (d === 'create') {
        const made = await this.q(
          `insert into ${students} (student_key, student_id, name, device_key) values ($1, $2, $3, $4)
           on conflict (student_key) do nothing returning student_key`,
          [i.studentKey, i.studentId, i.name, i.deviceKey],
        );
        if (made.length) return 'ok' as const;
        continue; // someone created it at the same moment: decide again
      }
      // 'ok' (same device) or 'relock' (unlocked by the admin): only succeeds if nobody else took it meanwhile
      const updated = await this.q(
        `update ${students} set name = $2, student_id = $3, device_key = $4, last_seen = now()
         where student_key = $1 and (device_key = $4 or device_key is null) returning student_key`,
        [i.studentKey, i.name, i.studentId, i.deviceKey],
      );
      if (updated.length) return 'ok' as const;
    }
    return 'conflict' as const;
  }

  async addAttempt(a: { studentKey: string; lab: string; exercise: string; passed: number; total: number; code: string }) {
    await this.q(`insert into ${this.t.attempts} (student_key, lab, exercise, passed, total, code) values ($1, $2, $3, $4, $5, $6)`, [a.studentKey, a.lab, a.exercise, a.passed, a.total, a.code]);
  }

  async setTask(t: { studentKey: string; lab: string; task: string; done: boolean }) {
    await this.q(
      `insert into ${this.t.tasks} (student_key, lab, task, done) values ($1, $2, $3, $4)
       on conflict (student_key, lab, task) do update set done = excluded.done, updated_at = now()`,
      [t.studentKey, t.lab, t.task, t.done],
    );
  }

  async setSubmission(s: { studentKey: string; lab: string; url: string }) {
    const subs = this.t.subs;
    await this.q(
      `insert into ${subs} as p (student_key, lab, url) values ($1, $2, $3)
       on conflict (student_key, lab) do update set url = excluded.url, updated_at = now(),
         reviewed = case when p.url = excluded.url then p.reviewed else false end`,
      [s.studentKey, s.lab, s.url],
    );
  }

  async hit(key: string, windowSec: number) {
    const [row] = await this.q<{ n: number }>(
      `insert into ${this.t.hits} as h (key, n, until) values ($1, 1, now() + make_interval(secs => $2::double precision))
       on conflict (key) do update set
         n = case when h.until < now() then 1 else h.n + 1 end,
         until = case when h.until < now() then now() + make_interval(secs => $2::double precision) else h.until end
       returning n`,
      [key, windowSec],
    );
    return Number(row?.n ?? 0);
  }

  async labData(lab: string): Promise<LabData> {
    const { students, attempts, tasks, subs } = this.t;
    const [studentRows, best, taskRows, subRows] = await Promise.all([
      this.q(
        `select * from ${students} where student_key in (
           select student_key from ${attempts} where lab = $1
           union select student_key from ${tasks} where lab = $1
           union select student_key from ${subs} where lab = $1)`,
        [lab],
      ),
      this.q(
        `select student_key, exercise, max(passed) as passed, count(*)::int as attempts,
                min(created_at) as first_at,
                min(created_at) filter (where passed = total) as solved_at,
                (array_agg(total order by passed desc, created_at desc))[1] as total
         from ${attempts} where lab = $1 group by student_key, exercise`,
        [lab],
      ),
      this.q(`select student_key, (count(*) filter (where done))::int as done from ${tasks} where lab = $1 group by student_key`, [lab]),
      this.q(`select student_key, url, reviewed, note, updated_at from ${subs} where lab = $1`, [lab]),
    ]);
    return {
      students: studentRows.map((r) => ({ ...r, created_at: iso(r.created_at)!, last_seen: iso(r.last_seen)! })),
      best: best.map((r) => ({
        student_key: r.student_key, exercise: r.exercise, passed: Number(r.passed), total: Number(r.total),
        attempts: Number(r.attempts), firstAt: iso(r.first_at)!, solvedAt: iso(r.solved_at),
      })),
      tasks: taskRows.map((r) => ({ student_key: r.student_key, done: Number(r.done) })),
      submissions: subRows.map((r) => ({ ...r, updated_at: iso(r.updated_at)! })),
    };
  }

  async studentData(lab: string, studentKey: string): Promise<StudentData> {
    const { students, attempts, tasks, subs } = this.t;
    const [[student], attemptRows, taskRows, [sub]] = await Promise.all([
      this.q(`select * from ${students} where student_key = $1`, [studentKey]),
      this.q(`select id, exercise, passed, total, code, created_at from ${attempts} where lab = $1 and student_key = $2 order by id desc limit 500`, [lab, studentKey]),
      this.q(`select task, done from ${tasks} where lab = $1 and student_key = $2`, [lab, studentKey]),
      this.q(`select url, reviewed, note from ${subs} where lab = $1 and student_key = $2`, [lab, studentKey]),
    ]);
    return {
      student: student ? { ...student, created_at: iso(student.created_at)!, last_seen: iso(student.last_seen)! } : null,
      attempts: attemptRows.map((r) => ({ ...r, id: Number(r.id), created_at: iso(r.created_at)! })),
      tasks: taskRows,
      submission: sub ?? null,
    };
  }

  async unlock(studentKey: string) {
    await this.q(`update ${this.t.students} set device_key = null where student_key = $1`, [studentKey]);
  }

  async review(studentKey: string, lab: string, reviewed: boolean, note: string) {
    await this.q(`update ${this.t.subs} set reviewed = $3, note = $4 where student_key = $1 and lab = $2`, [studentKey, lab, reviewed, note]);
  }
}
