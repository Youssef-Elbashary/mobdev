# CMS Milestone 1: Foundation, Course & Lists. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `/admin/cms` with editor sign-in, a drafts/publish status bar, and history. Saves are committed through GitHub (or to local files in dev). Editors for **Course & team** and the six **Lists**. Milestones 2–4 (Pages, Labs, Exercises) get their own plans.

**Architecture:**
- `src/lib/cms/*`: pure, unit-tested pieces: git blob sha, a line diff, YAML document editing, field specs, and the `ContentRepo` interface with `LocalRepo` and `GitHubRepo` (fetch is injected for tests).
- **API:** `src/pages/api/cms/*` (admin cookie + editor cookie).
- **Admin UI:** `src/pages/admin/cms.astro` (shell), plus `src/scripts/cms/{app,form,diff-view}.ts`.

**Tech Stack:** Astro 7 API routes, the `yaml` 2.x Document API, GitHub REST (`/git/refs`, `/git/blobs`, `/git/trees`, `/git/commits`, `/compare`, `/pulls`, `/deployments`, `/commits`), `node:crypto`.

## Global Constraints

- Don't touch the attendance files.
- The site build must produce identical pages after the refactors. Verify with `npm run build`, then visually check the home page, the footer and Lab 01's TeamCards.
- Branches: base `main` and drafts `cms-drafts`, overridable with `CMS_BASE` / `CMS_DRAFTS`. Repo from `GITHUB_REPO`, token from `GITHUB_TOKEN`. No token → LocalRepo, writing under the project root, and only on a laptop (never on Vercel).
- Commit message: `CMS: <summary> (by <Editor Name>)`.
- Every write carries `baseSha`; a mismatch → 409 with who changed the file last and when.
- Only paths under `src/content/` may be written (allow-list check in the repo layer).
- YAML edits keep comments: `yaml` `parseDocument` and node edits, never re-dumping a plain object.
- UI: site tokens, both themes, `data-reveal`/`.stg`, no horizontal scroll at 375 px, and `beforeunload` when there are unsaved changes.

## File map

| File | Responsibility |
|---|---|
| `src/content/schemas.ts` | All collection Zod schemas (moved from `content.config.ts`), plus `siteSchema` |
| `src/content/data/site.yaml` | course, team, assessment (moved from `site.config.ts`) |
| `src/site.config.ts` | Parses `site.yaml` (bundled with `?raw`) and re-exports `course`/`team`/`assessment`. `nav` stays here. |
| `src/lib/cms/sha.ts` | `blobSha(text)` = git's blob sha1 |
| `src/lib/cms/diff.ts` | `lineDiff(a, b)` → `{ type: ' ' \| '+' \| '-', text }[]` (LCS, trimmed context) |
| `src/lib/cms/yaml-list.ts` | list / get / set / add / remove / move entries in a YAML list document, and `setSite()` |
| `src/lib/cms/fields.ts` | Field specs for site and each list (types: text, textarea, enum, number, list, rows) |
| `src/lib/cms/repo.ts` | `ContentRepo`, `LocalRepo`, `GitHubRepo`, `RepoError` |
| `src/lib/cms/server.ts` | `getRepo()`, `requireEditor()`, `LISTS` registry, `validate()` |
| `src/pages/api/cms/*.ts` | `editor`, `status`, `publish`, `discard`, `history`, `site`, `list/[name]` |
| `src/pages/admin/cms.astro` + `src/scripts/cms/*.ts` | UI |
| `tests/cms.test.ts` | unit tests |

### Task 1: Refactors: schemas + site.yaml (behaviour unchanged)

- [ ] Move the schemas into `src/content/schemas.ts`, exported as functions where they need `image()` (e.g. `labSchema(image)`, `toolSchema(image)`). Add a CMS variant without `image()` using `z.string()`. `content.config.ts` becomes imports + `defineCollection` calls.
- [ ] Create `src/content/data/site.yaml` with today's exact `course`, `team`, `assessment` values. `site.config.ts`:
  - `import raw from './content/data/site.yaml?raw'`
  - `parse(raw)` with `yaml`
  - `siteSchema.parse(...)`
  - `export const { course, team, assessment }`
- [ ] Add `npm i yaml`.
- [ ] `npm run build` succeeds. Spot-check the built `index.html` contains the instructor name and the team emails.
- [ ] Unit test: `site.yaml` parses and validates.
- [ ] Commit.

### Task 2: Pure helpers (TDD)

- [ ] `blobSha`: test equals `git hash-object --stdin` for "hello\n" (`ce013625030ba8dba906f756967f9e9ca394464a`).
- [ ] `lineDiff`: equal → all context. Insert, delete, replace. Context trimmed to 3 lines around changes with `…` markers.
- [ ] `yaml-list`:
  - `listEntries(text)` → `[{ id, value }]`
  - `setEntry(text, id, value)` changes only that entry
  - `addEntry(text, value, afterId?)`
  - `removeEntry`, `moveEntry(text, id, toIndex)`
  - `setSite(text, value)`
  - **Tests:** the comments present in the real `commands.yaml` are all still present after `setEntry` on `cd`, and the edited value round-trips.
- [ ] `fields.ts`: a spec for site and each list. Test: every schema key has a field and vice versa, except `id`, which is shown read-only for existing entries.
- [ ] Commit.

### Task 3: Repos (TDD)

```ts
export type FileRef = { path: string; sha: string; content: string };
export type Change = { path: string; content: string | null; baseSha: string | null };
export type Status = { mode: 'github' | 'local'; changed: { path: string; status: string }[]; ahead: number; previewUrl: string | null; prUrl: string | null };
export class RepoError extends Error { constructor(public status: number, message: string, public info?: Record<string, unknown>) }
export interface ContentRepo {
  mode: 'github' | 'local';
  read(path: string): Promise<FileRef | null>;
  commit(changes: Change[], message: string): Promise<{ sha: string }>;
  status(): Promise<Status>;
  publish(): Promise<{ merged: true; prUrl: string } | { conflict: true; prUrl: string }>;
  discard(): Promise<void>;
  history(limit?: number): Promise<{ sha: string; message: string; date: string; url: string | null }[]>;
}
```

`RepoError` must be written without a parameter property (node type stripping).

- **LocalRepo(root):** fs read/write; sha = `blobSha`. History = last 20 commits in memory (local mode doesn't use git). Publish/discard throw `RepoError(400, 'Publishing is only available on the live site')`.
- **GitHubRepo({ token, repo, base, drafts, fetch }):**
  - `read`: `GET /repos/{r}/contents/{path}?ref=<drafts if it exists else base>`, base64-decoded.
  - `commit`:
    1. Make sure the drafts ref exists (`POST /git/refs` from base head).
    2. For each change, compare `baseSha` with the current blob sha of the path on drafts (`GET /contents?ref=drafts`). On a mismatch, look up the last commit touching the path (`GET /commits?path&sha=drafts&per_page=1`) → `RepoError(409, …, { by, at })`.
    3. Create blobs and a tree (`base_tree` = the drafts head's tree; deleted files get `sha: null`), then the commit, then `PATCH` the ref.
  - `status`: `GET /compare/{base}...{drafts}` (404 → nothing changed). The PR comes from `GET /pulls?head={owner}:{drafts}&state=open`. The preview URL from `GET /deployments?ref={drafts}&per_page=1` → `/statuses` → the first `environment_url`.
  - `publish`: open a PR if there isn't one (`POST /pulls`, title "CMS: publish drafts"), then `PUT /pulls/{n}/merge` (`merge_method: 'merge'`). On 405/409 → `{ conflict, prUrl }`. After the merge, `DELETE /git/refs/heads/{drafts}`.
  - `discard`: close the open PR if any, `DELETE` the drafts ref.
  - `history`: `GET /commits?sha={drafts or base}&path=src/content&per_page=30`, filtered to messages starting with `CMS:`.
- [ ] Tests with a fake fetch (a tiny in-memory GitHub: refs, blobs, trees, commits, contents):
  - first commit creates drafts
  - a two-file commit makes a single commit
  - a stale sha → 409 with `by`
  - status lists the changed paths
  - publish merges and deletes drafts
  - publish conflict → `{ conflict }`
  - discard
- [ ] LocalRepo tests on a temp dir: read, commit, stale → 409, the path allow-list refuses `../x` and `astro.config.mjs`.
- [ ] Commit.

### Task 4: API

- **`server.ts`:**
  - `getRepo()`: GitHub when `GITHUB_TOKEN` + `GITHUB_REPO` are set, Local when not on Vercel, else null → setup card.
  - `requireEditor(cookies)` → `{ editor }` or a 401/403 Response.
  - The editor cookie `cms_editor` (httpOnly, sameSite strict, 12 h) holds a team member's name, validated against `team`.
  - `LISTS = { commands, troubleshooting, resources, extra, roadmap, checklist }` → `{ path, schema, fields, label }`.
- **Routes** (all JSON, `prerender = false`, admin + editor required except `editor`):
  - `POST /api/cms/editor { name }` sets the editor cookie
  - `GET /api/cms/status`, `POST /api/cms/publish`, `POST /api/cms/discard`, `GET /api/cms/history`
  - `GET /api/cms/site` → `{ value, sha, fields }`. `POST /api/cms/site { value, baseSha, dryRun }` → validate → new text → `dryRun` ? `{ diff }` : commit → `{ ok, sha }`
  - `GET /api/cms/list/[name]` → `{ entries, sha, fields }`. `POST /api/cms/list/[name] { op: 'set'|'add'|'remove'|'move', id?, value?, toIndex?, baseSha, dryRun }` → the same flow. Every entry is validated with the collection schema, and ids must be unique.
- [ ] Curl smoke test in local mode, then revert any test edits with `git checkout -- src/content`.
- [ ] Commit.

### Task 5: UI

- **`/admin/cms`:** not admin → `/admin`. No repo → a setup card with the token steps. No editor cookie → a "Who's editing?" picker (team cards) → the app.
- **App layout:**
  - **sidebar:** Course · Lists (6) · History. Pages and Labs are greyed "coming next" until milestones 2–3.
  - **status bar:** the editor's name (switch), the mode badge (GitHub / Local), "N unpublished changes" with an expandable file list, Preview ↗, Publish, Discard (confirm). Local mode shows "Saved straight to files (local mode)".
- **Form engine** (`form.ts`): `renderForm(fields, value, onChange)` → elements. It supports text, textarea, enum (select), number, `list` (string chips with add/remove), and `rows` (repeatable object groups with up/down/remove/add). Validation errors from the server are shown under the matching field (by path, e.g. `team.1.email`).
- **Course view:** a site form with a live split-bar preview for assessment; **Review & save**.
- **List view:** a searchable table (id + title-ish field) with New / Duplicate / Delete / ↑↓. Clicking an entry opens the form panel; **Review & save**.
- **Review:** a modal with a colourised line diff and the commit message preview; **Save** or **Back**. After saving, a toast and a refreshed status.
- **History view:** a list of CMS commits with links.
- **Conflict (409):** a banner "Saved by X at T: reload". The form keeps your edits.
- `admin.astro` and `admin/progress.astro` get a "CMS" link next to the existing links.
- [ ] Browser e2e (local mode):
  - pick an editor
  - change the course term → the home page shows the new term (after reload)
  - add a command → `/commands` lists it
  - delete it, revert the term
  - a stale save shows the conflict banner
  - screenshots in dark/light and at 375 px
- [ ] README "CMS" section, then commit + push.
