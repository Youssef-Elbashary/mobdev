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

## Attendance (`/attendance` + `/admin`)

- **Students** open `/attendance`, type name + student ID and press Submit. Each device (phone or PC) can check in **once**. The same student ID can't appear twice.
- **Admin** opens `/admin`, logs in with `ADMIN_PASSWORD` and watches check-ins arrive live, within about a second (Server-Sent Events, with an automatic fallback to polling). There is **one list that never resets**.
- **Needs:** a Supabase project with `supabase/attendance.sql` run once in its SQL Editor, plus three Vercel environment variables: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (a secret key, never the publishable one) and `ADMIN_PASSWORD`. Redeploy after adding them. Until then, `/admin` shows a setup checklist. (An Upstash Redis store also works instead of Supabase.) The live site uses the table `attendance`; previews and local testing use `attendance_dev`. A daily Vercel cron calls `/api/attendance/status` so the free Supabase project doesn't pause.
- **Local dev:** with no database, an in-memory list is used. Put a throwaway `ADMIN_PASSWORD` in `.env.development.local` (git- and Vercel-ignored).
- **Code:** rules in `src/lib/attendance/core.ts` (unit-tested: `npm test`), Vercel/Astro glue in `src/lib/attendance/server.ts`, and endpoints in `src/pages/api/`. Only `/admin` and `/api/*` run on the server; everything else stays static.
- `GET /api/attendance/status` reports whether attendance is ready. It is read-only and never shows names.

## Project structure

```text
src/
├── content/             ← ALL course content (edit here)
├── content.config.ts    ← content schemas
├── site.config.ts       ← course name, overview text, navigation
├── pages/               ← one template per content type ([id].astro)
├── components/          ← reusable UI (Device, CmdLine, ProblemList, Rubric, Toc…)
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
