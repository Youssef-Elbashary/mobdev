# Mobile Development — Course Workspace

A single-course website for the Mobile Development course: labs, coursework, course project, command handbook, tools, setup, troubleshooting, resources and extra learning.

Built with [Astro](https://astro.build). It outputs a static site with very little JavaScript. **All content lives in `src/content/`, separate from the UI.** When you add a file there, the site builds a page for it with the same design as every other page of that type.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static site → dist/
npm run preview   # serve the built site
```

> On Windows, if `npm run` fails with `'"node"' is not recognized`, run Astro directly:
> `node node_modules/astro/bin/astro.mjs dev`

**Live site:** https://mobdev.vercel.app (the old `mobile-development-course.vercel.app` address redirects there).

**CI/CD:** a push to `main` deploys to production through Vercel's Git integration, and other branches and pull requests get their own preview links. GitHub Actions (`.github/workflows/ci.yml`) runs `npm test` and `npm run build` on every push and pull request.

---

## Adding content

| I want to add…            | Create / edit                                   | Appears at                |
| ------------------------- | ----------------------------------------------- | ------------------------- |
| A lab                     | `src/content/labs/lab-06.md`                    | `/labs/lab-06`            |
| Coursework                | `src/content/coursework/cw-03.md`               | `/coursework/cw-03`       |
| The course project        | `src/content/project/course-project.md`         | `/project`                |
| A tool                    | `src/content/tools/<tool>.md`                   | `/tools/<tool>`           |
| A setup guide             | `src/content/setup/08-something.md`             | `/setup/08-something`     |
| Commands                  | `src/content/data/commands.yaml`                | `/commands`               |
| Troubleshooting entries   | `src/content/data/troubleshooting.yaml`         | `/troubleshooting`        |
| Resources                 | `src/content/data/resources.yaml`               | `/resources`              |
| Extra learning            | `src/content/data/extra.yaml`                   | `/extra`                  |
| Roadmap stages            | `src/content/data/roadmap.yaml`                 | Home → roadmap            |
| Setup checklist items     | `src/content/data/checklist.yaml`               | `/setup` checklist        |
| Course name, overview, nav| `src/site.config.ts`                            | Everywhere                |

Everything is indexed for search automatically (`/search-index.json`, built at build time).
Fields are validated by `src/content.config.ts`. If a required field is missing, the build names the file and the field.

### Lab template (copy this to add Lab 06)

```md
---
number: 6
title: Working With APIs
description: One-sentence summary shown on cards and in search.
difficulty: Intermediate          # Beginner | Intermediate | Advanced
estimatedTime: 3 hours
skills: [fetch, async/await, Loading states]
roadmapStage: data                # id from roadmap.yaml — links the lab into the roadmap
objectives:
  - Fetch JSON from a REST API
prerequisites:
  - Lab 05 completed
expectedResult:
  description: What the student should see.
  image: ./images/lab-06-result.png   # optional — shown inside a phone frame
  screen: ['Title line', 'Row 1', 'Row 2']  # optional mock screen if no image
troubleshooting:
  - problem: Network request failed
    cause: localhost points to the phone itself
    solution: Use your computer's LAN IP
    commands: ['ipconfig']
submission:
  - GitHub link
extraChallenge: Optional stretch task.
resources:
  - { label: MDN fetch, href: 'https://developer.mozilla.org/en-US/docs/Web/API/fetch' }
draft: false                      # true hides it from the site
---

## Step 1 — Title of the step
Markdown content, code and images…

## Step 2 — Another step

## Testing
```

### Visual labs (`.mdx`)

Lab 01 is written in MDX (`src/content/labs/lab-01.mdx`). It uses the lab components below, and you don't need to import them. When you write `<Part>` and `<Task>`, the page builds the session-plan bar, the progress ring, the sidebar tracker and the Done checkboxes (saved in the student's browser) from them.

| Component | What it shows |
| --- | --- |
| `<Part n="1" title="…" time="10 min" />` | Big numbered part banner |
| `<Task n="1.1" title="…" time="2 min">…</Task>` | Task card with a **Done** checkbox |
| `<Checkpoint>…</Checkpoint>` | Green "you should now see…" box |
| `<Terminal lines={['$ cmd', 'output', '# comment', '> highlight', '[qr]']} />` | Terminal with commands **and** output |
| `<Explain parts={[['npx', 'meaning'], …]} />` | Every part of a command, colour-coded |
| `<Cards items={[…]} />` · `compact` | Visual cards (`+ ` ✓ / `- ` ✕ points, logos, icons) |
| `<ToolGrid items={[['react-native', 'why']]} />` | Tool tiles with real logos |
| `<TeamCards />` · `<SplitBar items={[…]} />` · `<Timeline items={[…]} />` | Team, animated split bar, animated timeline |
| `<FileTree lines={['app/', '  index.tsx # note *']} />` | Folder tree (`*` highlight, `-` dim) |
| `<AppPhone markers />` · `<BeforeAfter … />` | Phone previews of the app |
| `<GitFlow steps={…} current={3} compact />` | Branch diagram with "you are here" |
| `<ClickPath steps={['Settings', '…']} />` | "Where to click" path |
| `<GhSignup />` `<GhNewRepo />` `<GhQuickSetup />` `<GhToken />` `<GcmDialog />` `<GhPullRequest stage="open" />` `<VsCode />` | Annotated screen mockups |

A numbered list written right after a mockup or `<AppPhone markers />` becomes its legend automatically. Item 1 explains marker ①, and so on.

### Interactive playgrounds (Lab 02)

Students edit real React Native code on the page and see it run in a phone. Exercises also check the answer automatically.

| Component | What it shows |
| --- | --- |
| `<Playground ex="e05-counter" />` | **Exercise**: editor + live phone + console + ✅/❌ checks, 💡 hint, 👁 solution (unlocks after the first Check). Passing every check ticks the surrounding `<Task>` |
| `<Playground ex="demo-use-state" demo />` | **Live demo**: editable, starts by itself when scrolled into view |
| `<AppWalkthrough ex="recipes" />` | A multi-page app: file tree + code + live phone. Clicking a file moves the phone to that page and the other way round |
| `<MockScreen title="Movies" tab={0} rows={[…]} />` | A static phone mockup of a screen students must build (`variant`: `list`, `detail`, `form`, `empty`) |

Each playground is one file in `src/playgrounds/<lab>/<id>.ts`:

```ts
import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'Counter',
  goal: 'Add a **−** button…',            // `code`, **bold**, [links](…)
  hint: 'Use `Math.max(0, count - 1)`',
  files: { 'App.tsx': `…starter code with TODOs…` },
  solution: { 'App.tsx': `…` },
  checks: [
    { name: '+ adds 1', steps: [{ press: '+' }, { expectText: '1', exact: true }] },
  ],
} satisfies Playground;
```

Check steps act on the running app the way a student would: `press` (visible text or `testID`), `type` + `into` (placeholder or `testID`), `expectText` / `expectNoText` (`exact: true` = an element's whole text), `expectFocused`, `expectStyle` (computed CSS), `expectCode` (a regex over the code, with comments removed), and `wait` (ms). Every check starts from a fresh app. `npm test` verifies that every playground compiles and that each exercise has a solution and checks. A multi-file playground with an `app/` folder runs with Expo Router (`Stack`, `Tabs`, `Link`, `router`, `useLocalSearchParams`).

**How it runs:** `src/runner/` is bundled by `src/integrations/runner.mjs` (esbuild, on `astro dev` and `astro build`) into `public/runner/runtime.js`, which is git-ignored. The bundle contains React (development build, for readable errors), react-native-web and Sucrase. It runs in an `<iframe sandbox="allow-scripts">`, so student code can't touch the site. Code can import `react`, `react-native`, `expo-router` and its own files (`./x`, `@/x`).

### Markdown features

- **Numbered steps:** `## Step 3 — Title` is shown as a numbered step and listed in the sidebar.
- **Callouts:** `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`
- **Code blocks:** syntax highlighting, a copy button and a language label. Blocks longer than 3 lines get line numbers. `bash`, `sh` and `powershell` blocks are shown as terminal commands with a `$` prompt.
  - Filename header: ` ```tsx title="App.tsx" `
  - Highlight lines: ` ```tsx {3,5-7} `
  - Diff lines: add `// [!code ++]` or `// [!code --]` at the end of a line
- **OS tabs:** put `### Windows`, `### macOS` and `### Linux` headings one after another. The site turns them into tabs, selects the student's OS automatically and remembers their choice.
- **Tables** scroll sideways on phones.
- **Images:** place them next to the markdown file and reference them relatively. Astro optimises them.

### Tool logos

Put the image in `src/assets/tools/` and reference it from the tool's frontmatter: `logo: ../../assets/tools/react.svg`. Without a logo, the tool shows a text monogram (`monogram: AS`). Logos come from [devicon](https://devicon.dev) and each project's own site.

### Course info & teaching team

Edit `src/site.config.ts`: `course` (code, term, module leader), `team` (shown on the home page and in the footer) and `assessment` (the 60/40 split bar).

YAML tip: wrap a value in single quotes if it contains `: `, starts with `"`, or contains `{{`.

---

## Legacy attendance (`/attendance`)

- `/attendance` is the original standalone register. It is retained for its historical data, but it is deliberately separate from lab attendance and is not shown in the admin Attendance tab.
- Lab attendance is recorded from inside each lab and is described under Progress tracking below.
- **Needs:** a Supabase project with `supabase/attendance.sql` run once in its SQL Editor, plus three Vercel environment variables: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (a secret key, never the publishable one) and `ADMIN_PASSWORD`. Redeploy after adding them. Until then, `/admin` shows a setup checklist. (An Upstash Redis store also works instead of Supabase.) The live site uses the table `attendance`; previews and local testing use `attendance_dev`. A daily Vercel cron calls `/api/attendance/status` so the free Supabase project doesn't pause.
- **Local dev:** with no database, an in-memory list is used. Put a throwaway `ADMIN_PASSWORD` in `.env.development.local` (git- and Vercel-ignored).
- **Code:** rules in `src/lib/attendance/core.ts` (unit-tested: `npm test`), Vercel/Astro glue in `src/lib/attendance/server.ts`, and endpoints in `src/pages/api/`. Only `/admin` and `/api/*` run on the server; everything else stays static.
- `GET /api/attendance/status` reports whether attendance is ready. It is read-only and never shows names.

## Progress tracking (`/admin/progress`)

- **Students:** the lab is locked initially. A student enters their full name and student ID at the start, and the server verifies and binds that identity to the browser before revealing the content. The name cannot later be changed for that ID, and the same browser cannot claim another ID. Every Check is saved with its score and code, along with Done ticks and the repository link. Saves wait in a queue while offline.
- **Admin:** open `/admin/progress` (or **Lab progress →** on `/admin`) with `ADMIN_PASSWORD`. The Attendance tab on `/admin` and the detailed progress screen both use the same per-lab records; neither reads the legacy `/attendance` list. Clicking a student shows every attempt and the exact submitted code. **Allow new device** clears only the ID's browser binding, preserving all progress and attendance, so the student's next browser can become the bound device. **Export CSV** downloads the table for grading.
- **Progress %:** exercises 70% (best score ÷ checks, averaged over the lab's exercises), Done ticks 20%, and repository 10%. Without a repository it's 75 / 25. New labs need no setup: exercises are the `<Playground ex="…" />` tags (not `demo`) inside each `<Task>`.
- **Database:** Neon Postgres. In Vercel go to project → **Storage** → **Create Database** → **Neon** → **Connect to project** (all environments), which adds `DATABASE_URL`, then redeploy. The tables are created automatically. Production uses `progress_*` tables, while previews and local dev use `progress_dev_*`. Without `DATABASE_URL` on a laptop, an in-memory store is used.
- **Per-lab attendance:** every lab ends with a **Check in for Lab NN** card. It works only while an instructor has opened that lab's check-in from `/admin/progress`. The server accepts it only from the browser already bound to that exact ID and unchanged name, after at least 5 active minutes and 3 viewed sections. Repeated submissions are idempotent, and device, student and network rate limits reduce spam. The old `/attendance` page still works independently and never contributes to these totals.
- **Reading:** a task counts as **read** when at least 40% of it stays on screen for 4 s. **Active time** counts only while the tab is visible and the student did something in the last minute. The **Seen** column shows `21/26 · 1h 42m`. In the drawer, read-but-not-ticked tasks are outlined and ticked ones are green. Reading never changes the progress %.
- **Code:** rules in `src/lib/progress/core.ts` (unit-tested: `npm test`), storage in `src/lib/progress/store.ts`, Astro glue in `src/lib/progress/server.ts`, endpoints in `src/pages/api/progress/` and `src/pages/api/admin/progress/`, and the student-side script in `src/scripts/progress.ts`.

## Content manager (`/admin/cms`)

The password-protected CMS lets the teaching team edit course information and the six shared YAML lists without changing source files by hand. Open `/admin/cms` (or **CMS →** on `/admin`), choose your teaching-team name, edit an item, then use **Review & save** to inspect the exact line diff before saving.

- On a laptop, saves go straight to `src/content/` and Astro refreshes the site automatically.
- On Vercel, saves are commits on `cms-drafts`. Use **Preview** to inspect the deployment, **Publish** to merge all drafts into `main`, or **Discard** to throw all unpublished changes away.
- Every save records the editor's name. If the same file changed after you opened it, the CMS refuses the stale save and tells you to reload.
- The current milestone edits **Course & team**, **Commands**, **Troubleshooting**, **Resources**, **Extra learning**, **Roadmap**, and **Setup checklist**. Page, lab, and exercise editors are planned next.

For the hosted CMS, add these Vercel environment variables and redeploy:

- `GITHUB_REPO=Youssef-Elbashary/mobdev`
- `GITHUB_TOKEN` — a fine-grained token limited to this repository, with **Contents** and **Pull requests** read/write and **Deployments** read permission
- Optional: `CMS_BASE` (defaults to `main`) and `CMS_DRAFTS` (defaults to `cms-drafts`)

## Project structure

```text
src/
├── content/             ← ALL course content (edit here)
├── content.config.ts    ← content schemas
├── site.config.ts       ← course name, overview text, navigation
├── pages/               ← one template per content type ([id].astro)
├── components/          ← reusable UI (Device, CmdLine, ProblemList, Rubric, Toc…)
├── playgrounds/         ← live-code exercises & demos, one .ts file each (Lab 02+)
├── runner/              ← the sandboxed in-browser React Native runtime for playgrounds
├── layouts/Base.astro   ← nav, footer, search palette, theme
├── scripts/             ← app.ts (global behaviour) + search.ts (⌘K palette)
├── styles/global.css    ← design system tokens + components
└── plugins/             ← markdown extensions (callouts, step headings)
```

## Design system

Tokens are at the top of `src/styles/global.css`:

- **Color:** graphite and a "volt" lime accent (`--accent`) in dark mode; warm paper and ink in light mode. Both themes are defined as tokens, so every component supports both.
- **Type:** Bricolage Grotesque (display), Geist (body), Geist Mono (code, labels, technical values).
- **Motion:** only `transform` and `opacity` are animated. Page changes use view transitions. Everything respects `prefers-reduced-motion`.
- **Components:** `.btn`, `.chip`, `.badge`, `.kbd`, `.input`, `.panel`, `.callout`, `.row`, `.acc` (accordion), `.code-frame`, `.cmd-line`, `.empty`.

## Keyboard

- `Ctrl K` / `⌘ K`: open search anywhere
- `/`: open search. On the Command Handbook and Troubleshooting pages it focuses that page's filter instead.
- `↑` `↓` `↵` `Esc`: move through, open and close search results
