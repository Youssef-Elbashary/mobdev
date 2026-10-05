# Per-Lab Attendance & Reading Tracking: Design

**Date:** 2026-10-05 · **Branch:** `lab-02` · Extends progress tracking (`2026-10-05-progress-tracking-design.md`)

## Goal

- At the end of every lab, students **check in** for that lab. This only works while the admin has check-in open for that lab.
- The site records how far each student **went through the lab**: tasks seen and active time.
- `/admin/progress` shows, per lab, who attended (and when), next to their exercise progress and reading.

The existing `/attendance` page and its Supabase data are **unchanged**.

## Decisions

| Topic | Decision |
|---|---|
| Check-in | A card added by the lab template at the end of every lab (not in MDX), using the progress identity (name + ID, device-locked). |
| Window | The admin opens check-in per lab (optional auto-close after 15/30/60 min) and can close it. Outside the window → "closed". |
| Reading | A task is **seen** when ≥ 40 % of it stays on screen for 4 s. **Active time** = tab visible + interaction within the last 60 s. |
| Score | Progress % is unchanged. Attendance and reading are shown separately. |
| Storage | Neon, next to the progress tables: `{prefix}_checkins`, `{prefix}_sessions`, `{prefix}_views`. |

## Data

```sql
create table if not exists {p}_checkins (student_key text references {p}_students on delete cascade, lab text not null, at timestamptz not null default now(), primary key (student_key, lab));
create table if not exists {p}_sessions (lab text primary key, opens_at timestamptz not null, closes_at timestamptz);
create table if not exists {p}_views (student_key text references {p}_students on delete cascade, lab text not null, seen text[] not null default '{}', active_sec int not null default 0, updated_at timestamptz not null default now(), primary key (student_key, lab));
```

- Check-in is idempotent: the first time is kept.
- Views merge: `seen` is the union of all reports; `active_sec` is added up.

## API

| Route | Who | Does |
|---|---|---|
| `GET /api/progress/session?lab=` | anyone | `{ open, closesAt }` |
| `POST /api/progress/checkin` | student | lock check → session must be open (else 403 `closed`) → check in → `{ at }` |
| `POST /api/progress/views` | student | `{ lab, seen: string[] (task numbers), activeSec: 0–900 }` → merge |
| `POST /api/admin/progress/session` | admin | `{ lab, action: 'open', minutes?: 15/30/60/null }` or `{ lab, action: 'close' }` |

The dashboard data gains:
- per student: `attended: string | null`, `seen: number`, `activeSec: number`
- `totals.checkedIn`
- `session: { open, closesAt }`

The CSV gains the columns Attended, Check-in time, Tasks seen and Active minutes.

## UI

- **Check-in card**: the last block of the lab article. The ID chip style matches the progress identity. States: closed / open (with "closes at HH:MM") / done ("✓ Checked in at HH:MM") / conflict. It re-checks the session every 30 s while visible.
- **Reading tracker**: in `src/scripts/progress.ts`. It saves pending seen tasks and seconds per lab in `localStorage` and sends them every 30 s through the existing queue (only once signed in; anything gathered earlier is sent after sign-in).
- **Admin**:
  - a check-in control in the header (Open for 15/30/60 min / no limit, a countdown, Close now)
  - a 5th stat card, "Checked in"
  - two new table columns, Attended and Seen (`21/26 · 1h 42m`)
  - in the student drawer, the check-in time and the seen tasks highlighted next to the Done ticks

## Testing

- **Unit:** validation of check-ins and views, `sessionState`, and the memory store (check-in idempotent, session open/close/expiry, views union + sum, labData includes these).
- **E2E:**
  - the admin opens check-in, the student checks in, and the dashboard shows it
  - with check-in closed, the student is refused
  - a student who stays on a task for over 4 s has it counted as seen, with active time
