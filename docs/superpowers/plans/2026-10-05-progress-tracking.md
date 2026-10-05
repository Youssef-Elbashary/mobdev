# Student Progress Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save every student's exercise checks (score + code), Done ticks and repo link to Neon, keyed by name + student ID (locked to one browser). Show it all in a live `/admin/progress` dashboard with progress bars, a heat map, a student drawer with code, and a CSV export.

**Architecture:**
- **Rules:** pure TS in `src/lib/progress/core.ts` (validation, lock decision, scoring, lab structure) and `src/lib/progress/store.ts` (a `ProgressStore` interface with Memory and Neon implementations). All unit-tested.
- **Server:** Astro API routes (`prerender = false`) do the validating, rate limiting and storing. Admin routes reuse the attendance admin cookie (`isAdmin`).
- **Student side:** a small client module (`src/scripts/progress.ts`): identity sheet, a header chip, an offline queue. It's hooked into the playground controller, the Done boxes and a new `<RepoSubmit>`.
- **Admin page:** `/admin/progress` renders a shell and draws everything client-side from `/api/admin/progress`, polling every 5 s.

**Tech Stack:** Astro 7 API routes, `@neondatabase/serverless` 1.2 (`neon(url).query(text, params)`), `node --test`, Playwright-core (scratchpad e2e).

## Global Constraints

- Branch `lab-02`. **Do not edit** `src/lib/attendance/*` or the attendance API routes (they are being changed on `main` elsewhere). Only import `isAdmin` and `noStore` from `@/lib/attendance/server`. `src/pages/admin.astro` gets a single added link.
- Table prefix: `progress` on production (`VERCEL_ENV === "production"`), `progress_dev` everywhere else.
- Env: `DATABASE_URL`, falling back to `POSTGRES_URL`, read with `getSecret`. No URL + not on Vercel → MemoryStore. No URL on Vercel → 503 for student writes, and a setup notice in the admin.
- Validation limits:
  - name: same regex as attendance
  - ID: `^[A-Za-z0-9-]{3,20}$`
  - deviceKey: `^[A-Za-z0-9_-]{16,64}$`
  - code ≤ 20 000 chars
  - 0 ≤ passed ≤ total ≤ 50
  - URL: `^https://github\.com/[\w.-]+/[\w.-]+/?$`
- Rate limit 120 student writes per device per 10 min → 429.
- Progress % = 70·ex + 20·tasks + 10·submission. Without a submission it's 75/25; without exercises, tasks only.
- UI: site tokens only, both themes, motion via `transform`/`opacity`, respects `prefers-reduced-motion`, no horizontal scroll at 375 px.

## File map

| File | Responsibility |
|---|---|
| `src/lib/progress/core.ts` | types, validation, `decideLock`, `labStructure`, `scoreStudent`, `exerciseStats`, `toCsv` |
| `src/lib/progress/store.ts` | `ProgressStore` interface, `MemoryStore`, `NeonStore` (+ schema) |
| `src/lib/progress/server.ts` | `getProgressStore()`, `getStructures()`, `studentWrite()` helper |
| `src/pages/api/progress/{attempt,task,submission}.ts` | student writes |
| `src/pages/api/admin/progress/index.ts`, `student.ts`, `export.ts` | admin reads/actions |
| `src/scripts/progress.ts` | identity, queue, `record.*`, chip |
| `src/components/lab/IdentitySheet.astro` | the `<dialog>` + header chip markup/styles |
| `src/components/lab/RepoSubmit.astro` | repo link box (MDX) |
| `src/pages/admin/progress.astro` | dashboard |
| `tests/progress.test.ts` | unit tests |

---

### Task 1: Core rules (TDD)

**Files:** Create `src/lib/progress/core.ts` and `tests/progress.test.ts`. Modify the `package.json` test script.

**Interfaces (produced):**

```ts
export type Identity = { name: string; studentId: string; deviceKey: string };
export type LabStructure = { lab: string; title: string; tasks: { n: string; title: string }[]; exercises: { id: string; task: string; title: string; checks: number }[]; hasSubmission: boolean };
export type AttemptIn = Identity & { lab: string; exercise: string; passed: number; total: number; code: string };
export type TaskIn = Identity & { lab: string; task: string; done: boolean };
export type SubmissionIn = Identity & { lab: string; url: string };
export type Valid<T> = { ok: true; value: T & { studentKey: string } } | { ok: false; errors: Record<string, string> };

export function validateIdentity(o: unknown): Valid<Identity>;
export function validateAttempt(o: unknown, labs: LabStructure[]): Valid<AttemptIn>;
export function validateTask(o: unknown, labs: LabStructure[]): Valid<TaskIn>;
export function validateSubmission(o: unknown, labs: LabStructure[]): Valid<SubmissionIn>;
export function decideLock(existing: { device_key: string | null } | null, deviceKey: string): 'create' | 'ok' | 'relock' | 'conflict';
export function labStructure(lab: string, title: string, body: string, exerciseInfo: (id: string) => { title: string; checks: number } | null): LabStructure;
export type Best = { exercise: string; passed: number; total: number; attempts: number; firstAt: string; solvedAt: string | null };
export function scoreStudent(s: LabStructure, best: Best[], doneTasks: number, submitted: boolean): { percent: number; solved: number };
export function exerciseStats(s: LabStructure, bestByStudent: Best[][]): { id: string; solvedPct: number; avgAttempts: number; medianSolveMs: number | null }[];
export function toCsv(rows: (string | number)[][]): string;
```

- [ ] **Step 1: Write failing tests** covering:
  - validation (good input; a bad name, ID, deviceKey, unknown lab/exercise/task, passed > total, code too long, a non-GitHub URL)
  - all four `decideLock` outcomes
  - `labStructure` on the real `src/content/labs/lab-02.mdx`: 26 tasks, 11 exercises; `e05-counter` is in task `3.2`; demos are excluded; `hasSubmission` once `<RepoSubmit` is added in Task 6 (assert `false` for now on a fixture string, `true` on a string containing `<RepoSubmit lab="x" />`)
  - `scoreStudent`:
    - all solved + all tasks + submitted = 100
    - nothing = 0
    - half the checks on one of two exercises = 70 × 0.25 = 17.5 → rounded to 18
    - without a submission the weights are 75/25
  - `exerciseStats`: solved % and median
  - `toCsv` quoting (commas, quotes, newlines)
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3: Implement `core.ts`.**
  - Name regex copied from attendance.
  - `studentKey = studentId.toLowerCase()`.
  - `labStructure`: use `parseLabOutline(body)` from `@/lib/lab` (it's pure, so import it with a relative path `../lab.ts` so node can run it). Walk the body in order, tracking the current `<Task n="…">`; every `<Playground ex="X"` without the `demo` attribute becomes an exercise of that task.
  - `scoreStudent`: weights from the Global Constraints; percent rounded to an integer.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** "Add progress tracking core rules".

### Task 2: Stores (TDD for Memory, Neon by contract)

**Files:** Create `src/lib/progress/store.ts`, and extend `tests/progress.test.ts`.

```ts
export type StudentRow = { student_key: string; student_id: string; name: string; device_key: string | null; created_at: string; last_seen: string };
export interface ProgressStore {
  touchStudent(i: Identity & { studentKey: string }): Promise<'ok' | 'conflict'>; // runs decideLock, creates/relocks/updates name + last_seen
  addAttempt(a: { studentKey: string; lab: string; exercise: string; passed: number; total: number; code: string }): Promise<void>;
  setTask(t: { studentKey: string; lab: string; task: string; done: boolean }): Promise<void>;
  setSubmission(s: { studentKey: string; lab: string; url: string }): Promise<void>;
  hit(key: string, windowSec: number): Promise<number>;
  labData(lab: string): Promise<{ students: StudentRow[]; best: (Best & { student_key: string })[]; tasks: { student_key: string; done: number }[]; submissions: { student_key: string; url: string; reviewed: boolean; note: string; updated_at: string }[] }>;
  studentData(lab: string, studentKey: string): Promise<{ student: StudentRow | null; attempts: { id: number; exercise: string; passed: number; total: number; code: string; created_at: string }[]; tasks: { task: string; done: boolean }[]; submission: { url: string; reviewed: boolean; note: string } | null }>;
  unlock(studentKey: string): Promise<void>;
  review(studentKey: string, lab: string, reviewed: boolean, note: string): Promise<void>;
}
export class MemoryStore implements ProgressStore { … }
export class NeonStore implements ProgressStore { constructor(url: string, prefix: 'progress' | 'progress_dev') … }
```

- `labData.students` = the students with at least one row in this lab (attempt, task or submission), plus their `last_seen`.
- `best` per student × exercise:
  - the max of `passed` (ties → latest)
  - `total` from that row
  - `attempts` = the count
  - `firstAt` = the min of `created_at`
  - `solvedAt` = the min of `created_at` where passed = total
- **Neon:** the schema from the spec with `${prefix}_` table names, run once per instance (`create table if not exists …`). Queries use `sql.query(text, params)`. `best` comes from one SQL `group by` query (`max(passed)`, `count(*)`, `min(created_at)`, `min(created_at) filter (where passed = total)`), and the `total` of the best-scoring row from a `distinct on`.
- [ ] Tests for MemoryStore:
  - lock conflict
  - relock after unlock
  - attempts → best/attempts/solvedAt
  - task upsert toggling
  - submission + review
  - `hit` counting and window reset (inject a clock via `now()` in the constructor)
- [ ] Implement both stores; `npm test` → PASS.
- [ ] Commit "Add progress stores (memory + Neon)".

### Task 3: Server glue + API routes

**Files:** Create `src/lib/progress/server.ts` and `src/pages/api/progress/{attempt,task,submission}.ts`.

- `getProgressStore()` follows the attendance pattern (memoised; Neon if there's a URL; Memory if not on Vercel; else null). It exports `progressSetup()` returning `{ database: boolean }`.
- `getStructures()`: `getCollection('labs')` (not drafts) → `labStructure(id, title, body, info)`, where `info(id)` reads `getPlayground(id)` (title, `checks.length`), try/catch → null. Memoised.
- `studentWrite(request, validate, act)`:
  - parse JSON → validate → 400 `{ errors }`
  - no store → 503
  - `hit(\`w:${deviceKey}\`, 600) > 120` → 429
  - `touchStudent` conflict → 409 `{ error: 'device' }`
  - otherwise `act(store, value)` → 200 `{ ok: true }`
  - exceptions → 500
  All responses are JSON with `noStore` headers.
- [ ] Implement, then smoke-test with `curl` against the dev server (memory store):
  - valid attempt → 200
  - the same ID from a second deviceKey → 409
  - bad exercise → 400
- [ ] Commit "Add progress API".

### Task 4: Student side: identity, chip, queue, recording

**Files:** Create `src/scripts/progress.ts`, `src/components/lab/IdentitySheet.astro`, `src/components/lab/RepoSubmit.astro`. Modify `src/pages/labs/[id].astro` (render `<IdentitySheet />` + chip slot, register `RepoSubmit`, call `record.task` in the Done change handler), `src/scripts/playground/controller.ts` (await `ensureIdentity()` before a check; `record.attempt` on results), `src/content/labs/lab-02.mdx` (add `<RepoSubmit lab="lab-02" />` in Task 6.6).

`progress.ts` API:

```ts
export function getIdentity(): Identity | null;
export function ensureIdentity(): Promise<Identity | null>; // opens the sheet if needed; resolves null on cancel
export const record: {
  attempt(a: { lab: string; exercise: string; passed: number; total: number; files: Record<string, string> }): void;
  task(t: { lab: string; task: string; done: boolean }): void;
  submission(s: { lab: string; url: string }): Promise<{ ok: boolean; message?: string }>;
};
export function initProgressUi(): void; // chip state, "Not you?", online/flush listeners — called on astro:page-load
```

- Identity: `localStorage['progress:me']`; the deviceKey comes from `crypto.getRandomValues`, 18 bytes, base64url.
- Queue: `localStorage['progress:queue']` (max 200). `send()` posts and keeps the item on network error, 5xx or 429. It drops the item on 400. On 409 it drops all queued items and shows the conflict message in the chip and the sheet.
- The queue flushes on `online`, on `astro:page-load` and after every send.
- Chip states via `data-state="synced|saving|offline|conflict|anon"`. When anonymous it reads "Sign in to track progress" and opens the sheet.
- **When identity is first set,** every currently ticked Done box on the page is sent too.
- **Sheet:** a `<dialog>` using the site's `.input`/`.btn` classes, with inline validation that mirrors the server's rules. "Skip for now" resolves null, so the check still runs without being recorded.
- **RepoSubmit:** a URL input + button, a success state "✓ Submitted", and it shows the server error message.
- [ ] Implement.
- [ ] Browser e2e: the first Check opens the sheet → fill it in → the check runs → the dev store has the attempt (via the admin API). Then Done ticks and the repo submit get stored too.
- [ ] Commit "Record student progress from the lab pages".

### Task 5: Admin API + dashboard

**Files:**
- Create: `src/pages/api/admin/progress/index.ts` (GET `?lab=`), `student.ts` (GET detail; POST `{action:'unlock'|'review', id, lab, reviewed?, note?}`), `export.ts` (CSV), `src/pages/admin/progress.astro`
- Modify: `src/pages/admin.astro` (one link)

- **Admin GET response:** `{ labs: {id,title}[], structure, students: [{ key, id, name, lastSeen, percent, solved, tasksDone, submission, cells: { [exercise]: {passed,total,attempts} } }], exercises: exerciseStats, totals: {active, avgPercent, solved, submitted} }`. Unauthorised → 401.
- **Page:** not admin → redirect `/admin`; no DB on Vercel → a setup card. Otherwise:
  - a header (lab `<select>`, the Live dot, the Export CSV link, a link back to Attendance)
  - 4 stat cards (count-up)
  - an exercise overview with bars that grow `transform: scaleX`
  - a students table (sort buttons, search, a progress bar per row, heat cells, the repo icon, last seen as relative time)
  - the drawer (`<aside>` sliding with `transform`): attempts grouped by exercise; clicking one shows its code in a `<pre>` with file tabs; Mark reviewed + a note; Unlock device
- **Polling:** every 5 s while `document.visibilityState === 'visible'`. Rows are keyed by student; changed percentages animate the bar, and new or changed rows flash.
- All dynamic text is escaped (`textContent`, or an `esc()` helper for template strings).
- [ ] Implement.
- [ ] Browser e2e as admin: two simulated students → the table shows both with correct %; sorting and search work; the drawer shows their code; unlock and review persist; CSV downloads with the header row.
- [ ] Screenshots in dark and light themes, and at 375 px.
- [ ] Commit "Add live progress dashboard".

### Task 6: Docs, full verification, push

- [ ] README "Progress tracking" section: what's recorded, the env var, the Neon setup steps (Vercel → Storage → Neon), the `_dev` tables, the admin URL.
- [ ] `npm test`, `npm run build`, the Lab 02 e2e (exercises unchanged), the progress e2e.
- [ ] Commit, then `git push` (the branch is already on GitHub; the user is signed in).
