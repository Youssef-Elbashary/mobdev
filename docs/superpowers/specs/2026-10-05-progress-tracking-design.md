# Student Progress Tracking: Design

**Date:** 2026-10-05 · **Branch:** `lab-02` (follows Lab 02) · **Project A of 2** (Project B, a CMS for the whole site, gets its own spec later and reuses this database and admin login)

## Goal

Record what each student does in the labs and show it to the teaching team in a clear, live admin dashboard:

- Students identify themselves once (name + student ID).
- Every **Check** on an exercise is saved: score, time and code.
- Lab task **Done** ticks and the **Movies repo link** (Lab 02, Part 6) are saved.
- `/admin/progress` shows progress bars per student and per exercise, attempt history and submitted code, live during the lab.

Database: **Neon Postgres, provisioned through the Vercel Marketplace** (`DATABASE_URL`).

## Decisions

| Topic | Decision |
|---|---|
| Identity | Name + ID typed once, remembered in the browser. The ID is **locked to the first browser** that uses it (random device key). Admin can unlock. |
| Recorded data | **Every Check**: passed/total, code, time. Task ticks. Repo link. |
| Progress | Exercises (main weight) + task ticks + repo link. |
| Data layer | `@neondatabase/serverless` + plain SQL in `src/lib/progress/`. Schema created idempotently on first use. In-memory store on laptops without a DB. |
| Admin UI | New page `/admin/progress` (same password cookie as `/admin`). `admin.astro` only gets a header link, to avoid conflicts with attendance work on `main`. |
| Lab structure | Read from the lab content (`<Playground ex>` inside `<Task n>`, all `<Task>` tags), so future labs need no setup. |

## Data model (Postgres)

Production tables use the names below; previews and local dev use a `_dev` suffix (like attendance).

```sql
create table if not exists progress_students (
  student_key text primary key,          -- lower-case student ID
  student_id  text not null,             -- as typed
  name        text not null,
  device_key  text,                      -- locks the ID to one browser; null = unlocked
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create table if not exists progress_attempts (
  id          bigint generated always as identity primary key,
  student_key text not null references progress_students(student_key) on delete cascade,
  lab         text not null,             -- 'lab-02'
  exercise    text not null,             -- 'e05-counter'
  passed      int  not null,
  total       int  not null,
  code        text not null,             -- JSON of the files, ≤ 20 KB
  created_at  timestamptz not null default now()
);
create index if not exists progress_attempts_lab on progress_attempts (lab, student_key, exercise);
create table if not exists progress_tasks (
  student_key text not null references progress_students(student_key) on delete cascade,
  lab text not null, task text not null, done boolean not null,
  updated_at timestamptz not null default now(),
  primary key (student_key, lab, task)
);
create table if not exists progress_submissions (
  student_key text not null references progress_students(student_key) on delete cascade,
  lab text not null, url text not null,
  reviewed boolean not null default false, note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (student_key, lab)
);
create table if not exists progress_hits (key text primary key, n int not null, until timestamptz not null);
```

## Student side

- **Identity sheet**: a modal in the site's style. It opens on the first **Check** (or the first Done tick or repo submit) when no identity is stored, and asks for full name + student ID. Validation matches attendance:
  - name: letters, 2–60 characters
  - ID: 3–20 letters, digits or hyphens
  Stored in `localStorage` (`progress:me` = name, id, deviceKey). The deviceKey is random, 24 characters.
- **Identity chip** in the lab header shows "Mariam · 236541" and a sync state: ● synced (green), ● saving… (amber), ● offline – will retry (grey). It also has a "Not you?" link that clears the identity (it does not unlock the server lock).
- **Recording**: a small client module `src/scripts/progress.ts`.
  - The playground controller calls `record.attempt({ lab, exercise, passed, total, files })` after every check result.
  - The lab page script calls `record.task({ lab, task, done })` on every Done change. This includes auto-ticks from solved exercises.
  - The **RepoSubmit** component (new, MDX) calls `record.submission({ lab, url })`.
  Failed posts are queued in `localStorage` (`progress:queue`, max 200) and retried on the next action, when the browser comes back online, and on page load.
- **Errors shown to the student**:
  - device conflict (409) → "This student ID is already used on another device. Ask your TA to unlock it."
  - validation errors → shown inline in the sheet
  - server/DB down → silently queued, and the chip shows "offline"
- **RepoSubmit** (`<RepoSubmit lab="lab-02" />`): an input for a `https://github.com/<user>/<repo>` URL plus a Submit button. It shows the saved link and "✓ submitted". Placed in Lab 02 Task 6.6.

## Server API (Astro routes, `prerender = false`)

| Route | Who | Does |
|---|---|---|
| `POST /api/progress/attempt` | student | upsert student (lock check), insert attempt |
| `POST /api/progress/task` | student | upsert student, upsert task tick |
| `POST /api/progress/submission` | student | upsert student, upsert repo link |
| `GET  /api/admin/progress?lab=lab-02` | admin | dashboard data: structure + students + per-exercise best + task counts + submissions |
| `GET  /api/admin/progress/student?lab=…&id=…` | admin | one student's attempts (with code), tasks, submission |
| `POST /api/admin/progress/student` | admin | `{ action: 'unlock' | 'review', … }` |
| `GET  /api/admin/progress/export?lab=…` | admin | CSV |

Every student request carries `{ name, studentId, deviceKey }`. Rules (pure functions in `src/lib/progress/core.ts`, unit-tested):

- **Validation**:
  - lab must exist
  - exercise must be one of that lab's exercises
  - task must be one of its task numbers
  - 0 ≤ passed ≤ total ≤ 50
  - code JSON ≤ 20 000 chars
  - URL matches `^https://github\.com/[\w.-]+/[\w.-]+/?$`
- **Lock**:
  - new ID → create it, locked to this deviceKey
  - same deviceKey → OK, and the name is updated
  - row unlocked (`device_key` null) → re-lock to this device
  - otherwise → 409 `device`
- **Rate limit**: 120 student writes per device per 10 minutes (`progress_hits`) → 429.
- The name is refreshed on each write. `last_seen` is updated.

## Lab structure

`src/lib/progress/structure.ts` reads every lab's MDX body. It reuses `parseLabOutline` for the tasks, and for each task finds `<Playground ex="…" />` tags that are **not** `demo`. Result per lab:

```ts
{ lab: 'lab-02', title, tasks: [{ n: '3.2', title }], exercises: [{ id: 'e05-counter', task: '3.2', title, checks: 5 }], hasSubmission: boolean }
```

`hasSubmission` = the body contains `<RepoSubmit`. The server uses this structure to validate, and the admin uses it to draw the columns.

## Progress score (pure, unit-tested)

For one student in one lab:

- exercise score = Σ over exercises of `best passed / total` (a solved exercise = 1)
- **progress % = 70% × exercise score / #exercises + 20% × done tasks / #tasks + 10% × (submitted ? 1 : 0)**
- If the lab has no submission, the weights become 75/25. If it has no exercises, the progress is tasks only.

Per exercise (class view):
- **solved %** = the share of active students whose best = total
- **average attempts** before solving
- **median time to solve** = from the student's first attempt on that exercise to the first fully passing one

## Admin UI: `/admin/progress`

Same look and motion as the site: tokens, `data-reveal`, staggered `.stg`, count-up numbers, dark and light themes. If the admin is not logged in, it redirects to `/admin`. `admin.astro` gets a small "Attendance · Progress" switch in its header.

1. **Header**:
   - a lab picker
   - stat cards (count-up): active students, average progress, exercises solved (total), repos submitted (n / students)
   - a "Live" indicator
   - Export CSV
2. **Exercise overview**: per exercise, an animated progress bar (solved %), the average attempts and the median solve time. The lowest solved % is tagged "hardest".
3. **Students table**:
   - **Columns:** name + ID, a **progress bar** (%), one heat cell per exercise (solved = green ✓, partial = amber `3/5`, untried = grey), tasks `n/N`, a repo icon (green when submitted, ✓ when reviewed), and last seen ("2 min ago")
   - **Sorting** by progress (default), name or last seen
   - a **search** box
   - **Refresh:** every 5 s while the tab is visible. Changed rows get a short highlight (`opacity`/`transform` animation only).
4. **Student drawer** (slides in from the right):
   - name, ID, progress bar
   - per exercise, the attempts list with score and time; clicking an attempt shows the submitted code (read-only, highlighted, file tabs)
   - task ticks
   - the repo link with a "Mark reviewed" toggle and a note
   - an **Unlock device** button
5. Empty states: "No students yet: they appear here after their first Check."

## Setup

- `npm i @neondatabase/serverless`.
- Provision Neon from the Vercel Marketplace into the linked Vercel project. The user does a one-time `vercel login`, then `vercel link`. Then `vercel env pull` provides `DATABASE_URL` locally (git-ignored `.env.local`).
- Env read with `getSecret('DATABASE_URL')`, falling back to `POSTGRES_URL`.
- No URL, and not on Vercel → in-memory store (dev only). On Vercel without a URL → student writes return 503 (queued client-side), and the admin shows a setup notice.
- Tables are created on first use (`create table if not exists …`, memoised per instance).

## Testing

- **Unit** (`tests/progress.test.ts`): validation, the lock rules, scoring, structure parsing of the real `lab-02.mdx`, and the memory store (attempt → best → summary).
- **Build**: `npm run build`.
- **End-to-end** (Playwright in the scratchpad against the dev server with the memory store):
  - a student solves E5 → the identity sheet appears → the attempt is saved
  - Done ticks are saved
  - a repo link is submitted
  - the admin logs in and `/admin/progress` shows the student at the right %, with E5 green and the code visible in the drawer
  - a second browser with the same ID gets the device-conflict message
- **Manual**: dark/light themes, a 375 px wide screen, reduced motion.

## Out of scope

- The CMS (Project B).
- Moving attendance from Supabase to Neon. It can move later, in Project B, once the `main` work is merged.
- Student logins/passwords, and verifying checks on the server (the admin's code view is the safeguard).
