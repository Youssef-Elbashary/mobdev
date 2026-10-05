# Per-Lab Attendance & Reading Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** End-of-lab check-in (only while the admin has it open), tracking of tasks seen and active time, and both shown per lab in `/admin/progress`.

**Architecture:** This extends the progress modules: rules in `core.ts`, storage in `store.ts` (memory + Neon), and routes under `/api/progress/*` and `/api/admin/progress/*`. On the client it adds a `CheckinCard` component and a reading tracker in `src/scripts/progress.ts`.

## Global Constraints

- The existing attendance files stay untouched.
- Progress % is unchanged.
- Reading thresholds: a task is seen after 4 s at ≥ 40 % visible. Active time counts while the tab is visible and there was an interaction in the last 60 s. A views batch carries `activeSec` ≤ 900.
- Allowed session lengths: 15 / 30 / 60 minutes or no limit.

### Task 1: Rules + store (TDD)

- **`core.ts`:** add `validateCheckin(o, labs)`, `validateViews(o, labs)` (seen must be the lab's task numbers, max 100; `activeSec` an integer 0–900), and `sessionState(s: {opens_at, closes_at} | null, now): { open: boolean; closesAt: string | null }`.
- **`store.ts` interface + Memory + Neon:**
  - `getSession(lab)`
  - `openSession(lab, minutes | null)`
  - `closeSession(lab)`
  - `checkIn(studentKey, lab): Promise<string>` (returns the stored time; the first one wins)
  - `addViews(studentKey, lab, seen, activeSec)`
  - `labData` adds `checkins` and `views` and includes their students
  - `studentData` adds `checkin` and `views`
  - Neon gets 3 new tables in `migrate()`
- **Tests** in `tests/progress.test.ts`:
  - validation
  - `sessionState` open / closed / expired
  - check-in idempotent
  - views union + sum
  - `labData` includes a student who only checked in
- Commit.

### Task 2: API

- `studentWrite`'s `act` may return a `Response` or a value: a `Response` is returned as-is; a value becomes `json({ ok: true, ...value })`.
- `GET /api/progress/session`, `POST /api/progress/checkin` (403 `{error:'closed'}` when the session isn't open), `POST /api/progress/views`, `POST /api/admin/progress/session`.
- `buildDashboard` adds attended / seen / activeSec, `totals.checkedIn` and `session`. The CSV gets the new columns.
- Curl smoke test, then commit.

### Task 3: Student UI

- `src/components/lab/CheckinCard.astro`, rendered by `labs/[id].astro` after the article content for mission labs.
- `progress.ts`:
  - `wireCheckin()`: session polling, check-in, and the card states
  - `initReadingTracker()`: an IntersectionObserver on `.task[data-task]`, the active-time ticker, storage in `localStorage['progress:views:<lab>']`, and a flush every 30 s and on `visibilitychange: hidden`
- Browser e2e, then commit.

### Task 4: Admin UI

- **Header:** a check-in control (select 15/30/60/none + Open, a countdown + Close now).
- **Stats:** a 5th stat card.
- **Table:** Attended and Seen columns.
- **Drawer:** the check-in time, seen tasks, and active time.
- E2E + screenshots, README update, then commit + push.
