# Admin CMS: Design

**Date:** 2026-10-05 · **Branch:** `lab-02` · **Project B of 2** (follows progress tracking; reuses the admin login)

## Goal

Let the teaching team edit **all** site content from `/admin/cms`, without touching code:

- course info & teaching team
- the six YAML lists
- Markdown pages (coursework, project, tools, setup)
- MDX labs, including their auto-checked exercises

Edits are committed to GitHub as drafts, previewed on Vercel, and published with one click.

## Decisions

| Topic | Decision |
|---|---|
| Scope | Course & team · Lists · Pages · Labs (+ exercises) |
| Storage | Files stay in the repo. Saves are **commits via the GitHub REST API**. Vercel rebuilds. |
| Publishing | Saves go to branch **`cms-drafts`** (Vercel preview). **Publish** = PR `cms-drafts → main` + merge. **Discard** = reset drafts to `main`. |
| Sign-in | Existing admin password. After login the editor **picks their name** from the teaching team; it's written into every commit message. |
| Lab editing | **Outline** of Parts/Tasks (visual) + each task body in a **Markdown editor** with an **Insert** palette of component forms. **Exercise form** with a checks builder and **Test** in the real runner. |
| Local mode | Without `GITHUB_TOKEN` (laptop dev), saves write directly to the working tree. Publish/Discard are disabled. |

## Architecture

```
/admin/cms (UI) ──▶ /api/cms/* (admin cookie + editor name)
                       │ ContentRepo interface
          ┌────────────┴─────────────┐
   GitHubRepo (prod/preview)    LocalRepo (dev, no token)
   cms-drafts ─preview─▶ Publish (PR → merge) ─▶ main ─▶ live
```

**`ContentRepo` interface** (`src/lib/cms/repo.ts`):

```ts
type FileRef = { path: string; sha: string | null; content: string };
interface ContentRepo {
  mode: 'github' | 'local';
  read(path: string): Promise<FileRef | null>;                  // from cms-drafts if it differs, else main
  list(dir: string): Promise<string[]>;
  commit(changes: { path: string; content: string | null; baseSha: string | null }[], message: string): Promise<{ commit: string }>;
  status(): Promise<{ changed: { path: string; status: 'added' | 'modified' | 'removed' }[]; ahead: number; previewUrl: string | null; prUrl: string | null }>;
  publish(editor: string): Promise<{ merged: true } | { conflict: true; prUrl: string }>;
  discard(): Promise<void>;
  history(limit: number): Promise<{ sha: string; message: string; date: string; url: string }[]>;
}
```

**GitHubRepo** uses the GitHub REST API with `GITHUB_TOKEN`:
- **`commit`** goes through the Git Data API: get the ref, create blobs and a tree, create the commit, update the ref. It creates `cms-drafts` from `main` if missing.
- **Optimistic concurrency:** each change carries the `baseSha` of the blob it was read from. If the current blob sha differs, the server returns 409 with the last commit's author/time for that path.
- **`status`:**
  - `compare main...cms-drafts` gives the changed files and how far the drafts are ahead
  - the preview URL comes from `GET /deployments?ref=cms-drafts` → latest status `environment_url` (Vercel's GitHub integration posts these)
- **`publish`:** finds or creates the PR, then `PUT /pulls/{n}/merge` (merge commit). On 405/409 it returns `{ conflict, prUrl }`. After a merge it resets `cms-drafts` to main's head (or deletes the branch).
- **`discard`:** force-updates `cms-drafts` to main's head (or deletes it).
- **`history`:** `GET /commits?sha=main&path=src/content` plus drafts commits, filtered to messages starting with `CMS:`.

**LocalRepo** reads and writes `fs` under the project root. The sha is a git-style blob hash of the content. `status` reports `mode: local` and has no publish.

**Env:**
- `GITHUB_TOKEN`: fine-grained token on this repo only, with Contents R/W, Pull requests R/W and Deployments R
- `GITHUB_REPO` = `Youssef-Elbashary/mobdev`
- optional `CMS_BASE` = `main` and `CMS_DRAFTS` = `cms-drafts`

## Content model refactors (small, needed by the CMS)

1. **`src/content/schemas.ts`**: the Zod schemas currently inline in `content.config.ts` move here (pure `astro/zod`, image fields expressed as strings for CMS validation). `content.config.ts` imports them. The build behaves exactly as before.
2. **`src/content/data/site.yaml`**: `course`, `team`, `assessment` (and the overview text) move here from `site.config.ts`. `site.config.ts` imports and re-exports them, so nothing else changes. `nav`/`secondaryNav` stay in code.

## Editors (`/admin/cms`)

Layout:
- **sidebar:** Course · Labs · Coursework · Project · Tools · Setup · Lists · History
- **status bar:** the editor's name, "N unpublished changes" + file list, Preview ↗, Publish, Discard
- **editor pane**

Site tokens, both themes, `data-reveal`/`.stg` motion, no horizontal scroll at 375 px.

**Shared form engine** (`src/scripts/cms/form.ts`). It builds a form from a field description derived from the schemas:
- `text`, `textarea`, `markdown` (inline), `enum` (select), `number`, `boolean`, `date`
- `string[]` (chips/rows)
- `object[]` (repeatable groups, drag to reorder)
- `image` (path text for now)

Validation messages come from the server (the same Zod schema).

1. **Course & team**: the `site.yaml` form. Team rows (role, name, email) can be added, removed and reordered. The assessment rows show a live split-bar preview.
2. **Lists**: pick one of the 6 YAML files.
   - a searchable table of entries
   - an entry form from the collection schema (`id` + fields)
   - add, duplicate, delete, drag to reorder
   - saved via the `yaml` `Document` API, so comments and formatting outside the edited node are preserved
3. **Pages**: a list per collection (draft badge) with New (template) and Delete (confirm).
   - **Editor:** the frontmatter form, plus the body in CodeMirror (Markdown mode) with a toolbar (H2, bold, code, link, callout, `## Step N —`).
   - **Preview tab:** client-side Markdown rendering (`marked`) styled with `.prose`.
4. **Labs**: a list with New lab (outline template) and Duplicate.
   - **Header form:** all lab frontmatter fields.
   - **Outline:** Parts (title, time) containing Tasks (title, time). Add, rename, delete with confirm, and drag tasks across parts. Task numbers are renumbered `P.T` on save. The total time updates live.
   - **Task body:** CodeMirror Markdown with an **Insert** palette. Each component has a small form: Playground (pick an exercise or demo + the `demo` flag), Cards, Terminal, Explain, FileTree, Checkpoint, Callout, MockScreen, RepoSubmit, AppWalkthrough. With the cursor inside an existing tag, **Edit component** reopens its form filled in.
   - **Intro text** between a Part and its first Task is editable too.
   - **Exercises tab** (one per `src/playgrounds/<lab>/*.ts`):
     - title, goal, hint
     - starter and solution files (tabs; add/rename files)
     - a **checks builder**: a check = a name + steps; each step is a select (press / type+into / expectText(+exact) / expectNoText / expectFocused / expectStyle / expectCode / wait) with fields
     - **Test** runs the solution and the starter in a hidden runner iframe and shows results per check
     - **Save is enabled only when the solution passes every check and the starter fails at least one**
5. **History**: recent CMS commits (who, what, when, diff link).

**Before every commit:** the server validates with the schemas, plus the lab-specific rules: unique task numbers, Playground ids that exist, and the round-trip check. The UI shows a **Review changes** diff (a line diff of the file) with the commit message, then Save.

## Lossless round-trips

**Labs** (`src/lib/cms/mdx.ts`): `parseLab(source)` returns:

```ts
{ frontmatter: string /* raw YAML */, preamble: string,
  parts: { raw: string; n: string; title: string; time?: string; intro: string; tasks: { raw: string; n: string; title: string; time?: string; body: string }[] }[],
  tail: string }
```

`serializeLab(lab)`:
- concatenates each segment's original `raw` unless the segment is marked dirty
- dirty segments are regenerated in the house style (`<Part n="…" title="…" time="…" />`, `<Task …>\n\n{body}\n\n</Task>`)
- **Test:** `serializeLab(parseLab(x)) === x` for every lab file

**Component props** (`src/lib/cms/jsx-props.ts`): parse a tag's attributes with `acorn` (a JSX-free expression parse of each `{…}`).
- Literal values (string, number, boolean, array, object of literals) become editable.
- Anything else (identifiers, calls) is kept as raw code text.
- `printProps` writes them back with single-quoted strings and multi-line arrays, like the existing labs.

**YAML**: the `yaml` package `parseDocument` / `doc.setIn` / `toString` keeps comments.

**Exercises** (`src/lib/cms/exercise.ts`):
- **Reading:** the server reads the module's evaluated value (`getPlayground`). Locally it uses a fresh import.
- **Writing:** `printExercise(def)` writes canonical TS: `import type`, template-literal file contents (with `` ` `` and `${` escaped), checks as literals, and `satisfies Playground`.

## Errors

| Case | Result |
|---|---|
| Stale `baseSha` | 409 "Ali Motawea saved this file 2 min ago. Reload to see their changes." Your form keeps your text. |
| GitHub 401/403 | A setup card ("token missing or lacks permission X") |
| GitHub 5xx / network | A retry message; nothing lost |
| Publish conflict | "Someone changed the same file on main. Resolve it in the pull request ↗" |
| Validation failure | The field named and highlighted; nothing committed |
| Leaving with unsaved changes | `beforeunload` + in-app confirm |

All CMS routes require the admin cookie, plus an editor name chosen from `team` (a cookie `cms_editor`, set on a "Who's editing?" screen).

## Testing

- **Unit** (`tests/cms.test.ts`):
  - **Lab round-trip** byte-identical on `lab-01.mdx`/`lab-02.mdx`, plus edit cases: rename a task, move a task, add a part
  - **Props** parse/print (literals and raw code)
  - **YAML** edits keep comments
  - **Schema validation** catches a missing field
  - **Exercise** printing round-trip (print → eval → deep-equal)
  - **GitHubRepo** against a fake `fetch`: create the drafts branch, a multi-file commit, the stale-sha 409, publish merge, publish conflict, discard
  - **LocalRepo** on a temp dir
- **End-to-end** (local mode, Playwright, scratchpad):
  - log in, pick an editor
  - edit the course name → visible on the home page
  - add a command → visible on `/commands`
  - rename a Lab 02 task → visible in the tracker
  - insert a Callout via the palette
  - create an exercise, Test (solution passes / starter fails), save, and it renders as a Playground
  - a stale-save conflict
  - restore the files afterwards
- `npm test`, `npm run build`, and the existing Lab 02 and progress e2e suites.

## Milestones (each usable on its own)

1. `ContentRepo` (GitHub + Local), status bar (drafts / publish / discard / preview / history), editor sign-in, **Course & team**, **Lists**; plus the schemas and site.yaml refactors
2. **Pages**
3. **Labs**: header, outline, bodies, Insert palette, component forms
4. **Exercise editor**: checks builder + Test

## Out of scope

- Image uploads (paths only for now; uploading to the repo can come later)
- Rich WYSIWYG text editing (Markdown with toolbar + preview instead)
- Per-person passwords or GitHub OAuth
- Editing `nav` and code files
