# Lab 02 — Interactive Intro to React & React Native (design)

Status: sections 1–2 approved in chat (2026-10-05); sections 3–4 delegated ("do the best").

## Goal
A 90-minute live lab. Instructor explains a concept from the page (with a live demo), students immediately
practise in the site, get teaching feedback, and the instructor watches progress on `/admin`.
Pattern per concept: **Explain → Demo → Exercise → Feedback → next**. React Native gets the bigger share.

## 1. Flow (approved)
9 blocks × 10 min. Part 1 (React, browser frame, web tags) 0–30; Part 2 (React Native, phone frame) 30–90.
17 exercises: Ex1 order app-start steps · Ex2 label UI into components · Ex3 code Greeting ×2 ·
Ex4 code ProfileCard props ×3 · Ex5 code useState counter · Ex6 predict useEffect · Ex7 match RN components ·
Ex8 code profile screen · Ex9 fix RN bugs · Ex10 code TextInput greeting + Clear · Ex11 flexbox playground ·
Ex12 match NativeWind classes · Ex13 code style a card with NativeWind · Ex14 order a FlatList ·
Ex15 code CourseItem list · Ex16 code contacts search + favourites (2 files) · Ex17 final task list (2 files).

## 2. Student UI (approved)
Start card (name + student ID, every student). Sticky progress bar (block, exercise n/17, %, one square per
exercise). One long page. Workbench: task + live checklist, editor (tabs per file) | preview (browser/phone
frame), Check / Reset / Hint n/3 / Prev / Next, feedback ✅ correct (+why, +mini challenge) · 🟡 partial
(per-check messages) · ❌ not yet (teaching hint). No solution reveal. Code saved in localStorage.
Phones: [Code | Preview] tabs. Drag-and-drop everywhere also works by tap-tap and keyboard.

## 3. Engine
- **Editor**: CodeMirror 6 (`@codemirror/lang-javascript`, jsx+ts). Curated completions: JSX tags (RN core +
  components declared in the files) with snippets, props per component, hooks, `react-native` imports,
  NativeWind classes inside `className="…"`. Lint = compile errors (Sucrase) + runtime errors mapped to lines
  (Sucrase keeps line numbers). Theme follows site tokens (dark/light).
- **Compile** (parent page): Sucrase `typescript, jsx (automatic), imports` → CommonJS per file.
- **Preview** = sandboxed iframe (`sandbox="allow-scripts"`, opaque origin → student code can't touch the site,
  cookies or storage). `srcdoc` loads one classic script `/lab-runtime/runtime.js` (IIFE built by esbuild from
  `src/lab/runtime/` before `astro build`/`dev`). Runtime = React 19 + ReactDOM + react-native-web + shim.
- **`react-native` shim**: RNW components tagged with `data-rn="<Name>"`; `className` → style via twrnc
  (NativeWind stand-in); `View` throws RN's "Text strings must be rendered within a <Text> component" for raw
  text. Also provides `react/jsx-runtime`, `react-native-safe-area-context`, `expo-status-bar`, `nativewind`
  (no-op), CSS imports ignored; unknown modules → friendly error. Console captured → console panel.
- **Messages** parent⇄iframe: `run {files, entry, frame}` → `rendered | error {message, line, file} | log`;
  test RPC `query/press/type/style/text/logs/reset` used by checks.
- **Checks** (per exercise, in parent): `static` checks on a Babel AST (`@babel/parser`, errorRecovery) via a
  tiny query helper; `run` checks drive the preview through the RPC driver. Result per check pass/fail +
  message → overall pass / partial (score = passed/total) / fail. Same driver interface runs in Node tests
  against happy-dom, so every exercise is unit-tested with its reference solution and common mistakes.
- **Widgets** (vanilla TS, mounted by id from a registry): Workbench (code/fix/demo), Order, Match, Label,
  Predict, FlexPlayground. Astro components render shells: `<Exercise id>`, `<Demo id>`, `<LabStart>`.

## 4. Tracking & admin
- SQL `supabase/lab-progress.sql`: `lab_students (lab, student_key unique per lab, student_id, name, device_id,
  started_at, last_seen, completed_at)`, `lab_attempts (lab, student_key, exercise PK, attempts, hints,
  best_score, solved_at, first_at, last_at)`, `_dev` copies, RLS on, service_role only, RPC `lab_record(...)`
  doing atomic upserts. Completed = final challenge solved.
- `POST /api/lab/progress` (validated with the attendance rules, rate-limited) events: start / check
  (pass|partial|fail, score) / hint. Client queues events in localStorage when offline.
- `GET /api/admin/lab?lab=lab-02` (admin cookie): started, completed, live now (seen < 2 min), average
  completion %, per exercise {attempted, solved, notSolved, successRate, avgAttempts, hints}, hardest 3,
  per student {name, id, solved n/17, %, completed, minutes, last seen, per-exercise state}.
- `/admin` gets tabs **Attendance | Lab 02**; Lab tab polls every 4 s: KPI tiles, exercise bars with
  success %, "hardest" chips, student × exercise heat-grid.
- Backend interface with Supabase + in-memory implementations (memory = local dev/tests).

## Testing
`node --test`: lab-progress store + validation (memory), aggregation maths, every exercise's checks against
reference solution / starter / typical mistakes (happy-dom runtime). Browser verification on the dev server.

## Delivery
Branch `lab-02` → Vercel preview link for review → merge to `main` (auto-deploys) after approval.
