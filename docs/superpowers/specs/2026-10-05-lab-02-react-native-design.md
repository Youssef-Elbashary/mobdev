# Lab 02 — React & React Native: Syntax, Hooks & Your First Multi-Page App

**Date:** 2026-10-05 · **Branch:** `lab-02` (merged into `main` later, together with the Lab 01 work done on another device)

## Goal

Add Lab 02 to the course site. It teaches React / React Native syntax, components, hooks and navigation with:

1. **Concept explanations** in the same visual style and motion as Lab 01.
2. **Live demos** that students can edit and re-run on the page.
3. **Mini exercises** solved directly on the site. Each one has a phone preview, a console and automatic ✅/❌ checks.
4. **A solved 4-page app (Recipes)**, explained file by file, running live on the page.
5. **A 4-page app students build themselves (Movies watchlist)** in their own Expo project during the lab.

Content follows the two reference decks ("Modern Web Development" Sessions 5 & 6, text extracted to the git-ignored `refs/` folder):

- Session 5: SPA vs MPA, what React is, component-based architecture, JSX, class vs function components, hooks (`useState`, `useEffect`, `useRef`, `useMemo`), routing.
- Session 6: the To-Do List practical (state, list, input + `useRef`, add handler), with the challenge to check and delete items. Its Git half is already covered by Lab 01.

Everything is translated to React Native (`View`/`Text`/`TextInput`/`Pressable`/`FlatList`, `expo-router` instead of React Router).

## Session plan (3 hours, completed in the lab)

| Part | Time | Content |
|---|---|---|
| 1 · React in one picture | 15 min | SPA vs multi-page, what React is, component tree, function vs class components, web → native element mapping |
| 2 · JSX & components | 30 min | JSX rules, props, `children`, conditional rendering, lists (`.map` + `key`, then `FlatList`) · E1–E4 |
| 3 · Hooks | 45 min | `useState`, events, `useEffect` (deps, cleanup), `useRef`, `useMemo` · E5–E9 |
| 4 · Practical: To-Do | 20 min | The slides' To-Do, built step by step · E10–E11 |
| 5 · Navigation + solved Recipes app | 30 min | `expo-router` (Stack, Tabs, `Link`, params), Context, walkthrough of the live Recipes app |
| 6 · Your turn: Movies app | 40 min | Students build the 4-page Movies watchlist, push a branch, open and merge a PR |

The lab uses Lab 01's `<Part>` / `<Task>` components, so the session-plan bar, progress ring, tracker and Done checkboxes all work unchanged.

## Mini exercises

| # | Exercise | Checks (performed on the preview) |
|---|---|---|
| E1 | Fix the JSX: two root elements, text outside `<Text>`, `class=` | renders without error · shows "Hello" and "Mobile Dev" |
| E2 | Profile card with props, used twice | 2 cards · each shows its own name and role |
| E3 | Status from a boolean prop (Online 🟢 / Offline 🔴) | both states render the right text |
| E4 | List of courses with `.map()` + `key` | 4 rows · no missing-key warning in the console |
| E5 | Counter: `+`, `−`, Reset, never below 0 | starts at 0 · `+` → 1 · `−` at 0 stays 0 · Reset → 0 |
| E6 | Live greeting with a controlled `TextInput` + character count | typing "Sara" → "Hello, Sara" and "4" |
| E7 | Stopwatch: `useEffect` + `setInterval` + cleanup | counts up after Start · stops after Stop |
| E8 | Focus the input from a button with `useRef` | the input is focused after the tap |
| E9 | Search filter with `useMemo` | typing "re" leaves only the matching items |
| E10 | To-Do: add (slides steps 3–7) | "Milk" creates a row · input clears · empty input ignored |
| E11 | To-Do challenge: check + delete | tap toggles done (line-through) · 🗑 removes the row |

Every concept also gets a **demo** playground: the same runner, editable, without checks. Example: a `useEffect` demo that logs `mounted` / `updated` / `cleanup`.

## The runner

### Usage in MDX (no import needed, like Lab 01's components)

```mdx
<Playground ex="e05-counter" />
<Playground ex="demo-use-effect" demo />
```

### Exercise definition: `src/playgrounds/lab-02/<id>.ts`

```ts
export default {
  title: 'Counter',
  goal: 'Markdown: what to build',
  hint: 'Markdown hint',
  files: { 'App.tsx': `…starter…` },          // multi-file allowed (Recipes demo)
  solution: { 'App.tsx': `…solution…` },      // omitted for demos
  checks: [
    { name: 'starts at 0', steps: [{ expectText: '0' }] },
    { name: '+ adds 1', steps: [{ press: '+' }, { expectText: '1' }] },
  ],
} satisfies Playground;
```

Check step vocabulary:
- `press` (by visible text or `testID`)
- `type` (into an input found by placeholder or `testID`)
- `expectText`
- `expectNoText`
- `expectCount` (matching elements)
- `expectFocused`
- `expectStyle` (e.g. line-through)
- `wait` (ms)
- `expectNoConsole` (regex, e.g. missing `key`)
- `expectNoError`

Checks run after a fresh re-mount of the student's code, so one check can't affect the next.

### Components

1. **`src/components/lab/Playground.astro`** renders the shell:
   - a card with a file tab and a toolbar (Run · Check · Reset · 💡 Hint · 👁 Solution); the solution is unlocked after the first Check
   - the editor
   - a phone preview inside the existing `Device` frame
   - a console panel and a check list
   - entrance motion via `data-reveal` and `.stg`
   It server-renders the starter code, so the page reads fine before any JS loads.
2. **Editor**: CodeMirror 6, themed with the site tokens (dark and light). Lazy-loaded on first interaction or when the playground scrolls into view.
3. **Runtime page `src/pages/runner.astro`** (`/runner`) is a single cached bundle with React, react-dom, react-native-web and Sucrase (TSX → JS).
   - It loads in an iframe with `sandbox="allow-scripts"`, so student code has no access to the site's origin or storage.
   - Module map:
     - `react`
     - `react-native` → `react-native-web`
     - `expo-router` → local shim
     - `expo-status-bar` → no-op
     - relative imports between the exercise's own files
4. **`expo-router` shim**: builds routes from the exercise's `app/` file names. It supports:
   - `_layout.tsx`
   - groups like `(tabs)`
   - dynamic `[id].tsx`
   - `Stack`, `Tabs` (bottom tab bar), `Link`, `router.push/back`, `useLocalSearchParams`, `useRouter`
   The walkthrough can tell it which screen to show.
5. **Messaging**: the parent and the iframe use `postMessage`:
   - `run`, `check` and `navigate` go to the iframe
   - `console`, `error`, `ready` and `check-result` come back
   Runtime errors show as an in-phone red error screen, like RN's.
6. **Progress**: passing all checks ticks the enclosing Task's Done box, which feeds the existing ring, tracker and plan. Student code is saved in `localStorage` per exercise. Reset restores the starter code.
7. **Performance**: nothing heavy loads on page load. Demos auto-run when scrolled into view; exercises wait for Run. Runtime and editor are separate chunks, shared by every playground.

### Recipes walkthrough component

**`<AppWalkthrough ex="recipes" />`** shows a file tree, the selected file's code and the live phone. Clicking a file shows its code and navigates the phone to that screen. Each file has a short note that links back to the task that taught the concept.

## Solved app: Recipes

```text
app/_layout.tsx            Stack + RecipesProvider
app/(tabs)/_layout.tsx     Tabs: Recipes · Favorites · Add
app/(tabs)/index.tsx       1 Home — FlatList + search (useMemo)
app/(tabs)/favorites.tsx   3 Favorites — shared state via Context
app/(tabs)/add.tsx         4 Add recipe — form, validation, router
app/recipe/[id].tsx        2 Details — params, ♥ toggle, ingredients
components/RecipeCard.tsx  props
context/recipes.tsx        createContext + useRecipes() custom hook
data/recipes.ts            6 recipes (emoji images: works offline)
```

The same files run in the runner and work unchanged in a real Expo project with the tabs template.

## Student app: Movies watchlist

| Page | Requirements |
|---|---|
| 1 Movies (tab) | FlatList of `MovieCard` (props) + title search |
| 2 `movie/[id]` | title, year, genre, rating, watchlist toggle |
| 3 Watchlist (tab) | saved movies only, count in the header, empty state |
| 4 Add movie (tab) | title, year, genre; title required, year numeric; adds and navigates back |

The students' tasks include:
- create the project (`npx create-expo-app@latest movies-app --template tabs`)
- copy `data/movies.ts`
- mirror the folder tree
- one task per page, each with a requirement checklist and a phone mockup checkpoint
- Git: branch `feature/movies-app`, a commit per page, push, PR and merge, as in Lab 01

The frontmatter adds:
- **troubleshooting**: conditional hooks, missing `key`, infinite `useEffect`, params are strings, `Text strings must be rendered within a <Text>`
- **submission**: repo link + 4 screenshots
- **extraChallenge**: persist the watchlist with AsyncStorage

## Files

New:
- `src/content/labs/lab-02.mdx`
- `src/components/lab/Playground.astro`, `src/components/lab/AppWalkthrough.astro`
- `src/scripts/playground/*`: parent-side controller, editor setup, the check runner protocol
- `src/runner/*`: runtime, module map, expo-router shim, check engine
- `src/pages/runner.astro`
- `src/playgrounds/lab-02/*.ts`: 11 exercises, demos, and the Recipes app
- `tests/runner.test.ts`

Changed (kept minimal to ease the later merge with `main`):
- `src/pages/labs/[id].astro`: register `Playground` and `AppWalkthrough`
- `package.json`: deps `react`, `react-dom`, `react-native-web`, `sucrase`, `@codemirror/*`; the test script also runs the new test
- `README.md`: document `<Playground>` and the exercise file format

## Testing

- **Unit** (`node --test`, in `npm test`):
  - the check engine (step parsing and matching)
  - the module mapper and Sucrase transform
  - the expo-router shim's route table built from file names
- **Build**: `npm run build` passes.
- **End-to-end** (temporary Playwright in the scratchpad, not a project dependency):
  - for every exercise, the **solution** passes all checks and the **starter** fails at least one
  - every demo renders without an error
  - the Recipes app navigates through all 4 screens
- **Manual**: dark and light themes, a phone-width layout without horizontal scroll, reduced motion.

## Out of scope

- Running student code on a real phone from the site. Students do that with their own Expo project in Part 6.
- Server-side storage of student progress. It stays in the browser, like Lab 01.
- Changes to Lab 01 or to shared design tokens.
