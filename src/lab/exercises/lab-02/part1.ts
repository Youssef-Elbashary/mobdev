/** Lab 02 · Part 1 — React fundamentals (web frame). Exercises 1–6. */
import type { CodeExercise, LabelExercise, OrderExercise, PredictExercise } from '../types.ts';
import { comp, containsCall, el, firstJsxText, jsxShows, occurrences, stateHooks, walk, components } from '../helpers.ts';

export const ex01: OrderExercise = {
  id: 'ex01',
  n: 1,
  title: 'Order the app start-up',
  minutes: 2,
  level: 1,
  kind: 'order',
  prompt: 'Drag the steps into the order they happen when a React app starts.',
  items: [
    'The browser loads `index.html` — it has an empty `<div id="root">`',
    '`main.tsx` runs: `createRoot(document.getElementById("root"))`',
    '`.render(<App />)` asks React to show your root component',
    '`App` returns JSX — including children like `<Header />`',
    'React turns that JSX into real UI on the screen',
  ],
  hints: [
    'Nothing can run before the page itself exists.',
    '`createRoot` needs a place to draw into, so `#root` must already be there.',
    'JSX is only a description of the UI — drawing it is the very last step.',
  ],
  success:
    'Exactly: page → `main.tsx` finds `#root` → `render(<App />)` → `App` and its children return JSX → React draws it. Expo is the same idea: the entry loads `app/_layout.tsx`, which shows `app/index.tsx` — your first screen.',
};

export const ex02: LabelExercise = {
  id: 'ex02',
  n: 2,
  title: 'Split a screen into components',
  minutes: 2,
  level: 1,
  kind: 'label',
  screen: 'shop',
  prompt: 'Drag a component name onto each part of the screen. A name can be used more than once.',
  chips: ['App', 'Header', 'SearchBar', 'ProductCard', 'TabBar'],
  zones: [
    { id: 'screen', answer: 'App', label: 'the whole screen', why: 'The whole screen is the root component — it contains all the others.' },
    { id: 'header', answer: 'Header', label: 'top bar', why: 'The top bar (title + cart) is its own small component.' },
    { id: 'search', answer: 'SearchBar', label: 'search box', why: 'The search box is one reusable piece.' },
    { id: 'card1', answer: 'ProductCard', label: 'first product', why: 'Both products have the same shape with different data — one component used twice.' },
    { id: 'card2', answer: 'ProductCard', label: 'second product', why: 'Same shape as the first product → the same ProductCard, with different props.' },
    { id: 'tabs', answer: 'TabBar', label: 'bottom bar', why: 'The bottom navigation is a separate component.' },
  ],
  hints: [
    'Start with the biggest box: what contains everything?',
    'Two parts look the same but show different products…',
    'Every screen = one root component made of small, reusable pieces.',
  ],
  success:
    'That’s how React developers think: one root (`App`) built from small pieces. `ProductCard` appears twice — the same component with different data. That data is called **props** (next block!).',
};

export const ex03: CodeExercise = {
  id: 'ex03',
  n: 3,
  title: 'Your first component',
  minutes: 4,
  level: 2,
  kind: 'code',
  frame: 'web',
  entry: 'App.tsx',
  prompt: 'Create a `Greeting` component that returns a heading, then show it **twice** inside `App`.',
  files: {
    'App.tsx': `// 1. Create a component called Greeting that returns <h2>Hello, React!</h2>
// 2. Show it twice inside App

export default function App() {
  return (
    <div>
      <h1>My first components</h1>
      {/* put <Greeting /> here — twice */}
    </div>
  );
}
`,
  },
  checks: [
    {
      id: 'defined',
      label: 'a `Greeting` component exists',
      fail: 'Create the component above App: `function Greeting() { return <h2>Hello, React!</h2>; }`',
      static: (c) => {
        const p = c.file();
        if (components(p).some((f) => f.name === 'Greeting' && f.returnsJsx)) return true;
        if (/function\s+greeting\b|const\s+greeting\s*=/.test(p.code))
          return 'Component names must start with a capital letter: `Greeting`, not `greeting`. React treats lowercase tags like `<greeting>` as HTML.';
        if (comp(p, 'Greeting')) return '`Greeting` must return JSX, e.g. `return <h2>Hello, React!</h2>;`';
        return false;
      },
    },
    {
      id: 'twice',
      label: '`App` shows `<Greeting />` twice',
      fail: 'Use your component like a tag, twice, inside App’s `<div>`: `<Greeting />`',
      static: (c) => {
        const n = el(c.file(), 'Greeting').length;
        return n >= 2 || (n === 1 ? 'You used `<Greeting />` once — add a second one.' : false);
      },
    },
    {
      id: 'renders',
      label: 'it appears twice on screen',
      fail: 'Your greeting should be visible twice in the preview.',
      run: async (c) => {
        const g = comp(c.file(), 'Greeting');
        const phrase = firstJsxText(g?.node);
        const text = await c.app.text();
        if (!phrase) return text.length > 0;
        const times = occurrences(text, phrase);
        return times >= 2 || `I can see “${phrase}” ${times} time${times === 1 ? '' : 's'} on screen — it should be twice.`;
      },
    },
  ],
  hints: [
    'A component is a function whose name starts with a **capital letter** and that returns JSX.',
    'Put it above App: `function Greeting() { return <h2>Hello, React!</h2>; }`',
    'Use it like an HTML tag inside App’s `<div>`: `<Greeting />` — write it twice.',
  ],
  success: 'You built a component and reused it. Every time React meets `<Greeting />` it calls `Greeting()` and puts the returned JSX in that spot.',
  challenge: 'Create a `Footer` component and show it at the bottom of `App`.',
};

export const ex04: CodeExercise = {
  id: 'ex04',
  n: 4,
  title: 'Reusable ProfileCard with props',
  minutes: 4,
  level: 4,
  kind: 'code',
  frame: 'web',
  entry: 'App.tsx',
  prompt: 'Make `ProfileCard` receive `name` and `role` **props** and show them. Then show **3 cards** with different people.',
  files: {
    'App.tsx': `// ProfileCard should show the name and role it RECEIVES as props.
function ProfileCard() {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, marginBottom: 8 }}>
      <h3>Name here</h3>
      <p>Role here</p>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <ProfileCard />
    </div>
  );
}
`,
  },
  checks: [
    {
      id: 'receives',
      label: '`ProfileCard` receives `name` and `role`',
      fail: 'Add the props as the first parameter: `function ProfileCard({ name, role })`.',
      static: (c) => {
        const f = comp(c.file(), 'ProfileCard');
        if (!f) return 'Keep the `ProfileCard` component (`function ProfileCard …`).';
        const missing = ['name', 'role'].filter((k) => !f.props.has(k));
        if (!missing.length) return true;
        if (f.paramStyle === 'none') return 'ProfileCard has no props yet — add them as its parameter: `function ProfileCard({ name, role })`.';
        return `ProfileCard doesn’t receive the \`${missing.join('` and `')}\` prop yet.`;
      },
    },
    {
      id: 'shows',
      label: 'it shows `{name}` and `{role}`',
      fail: 'Replace the fixed text with the props: `<h3>{name}</h3>` and `<p>{role}</p>`.',
      static: (c) => {
        const f = comp(c.file(), 'ProfileCard');
        return !!f && jsxShows(f.node, 'name') && jsxShows(f.node, 'role');
      },
    },
    {
      id: 'three',
      label: '`App` shows 3 cards with `name` and `role`',
      fail: 'Show three cards in App: `<ProfileCard name="Mariam" role="Student" />` (and two more).',
      static: (c) => {
        const cards = el(c.file(), 'ProfileCard').filter((e) => e.attrs.name && e.attrs.role);
        return cards.length >= 3 || (cards.length ? `You have ${cards.length} card${cards.length === 1 ? '' : 's'} with name and role — make it 3.` : false);
      },
    },
    {
      id: 'different',
      label: 'each card has different data',
      fail: 'Give each card a different name — same component, different data.',
      static: (c) => {
        const names = el(c.file(), 'ProfileCard').map((e) => e.attrs.name?.value ?? e.attrs.name?.code ?? '');
        return new Set(names.filter(Boolean)).size >= 3;
      },
    },
    {
      id: 'visible',
      label: 'the names appear on screen',
      fail: 'The names you pass don’t appear on screen — show `{name}` inside ProfileCard’s JSX.',
      run: async (c) => {
        const names = el(c.file(), 'ProfileCard').map((e) => e.attrs.name?.value).filter((v): v is string => !!v);
        if (!names.length) return false;
        const text = await c.app.text();
        const missing = names.filter((n) => !text.includes(n));
        return missing.length === 0 || `I can’t see ${missing.map((m) => `“${m}”`).join(', ')} on screen.`;
      },
    },
  ],
  hints: [
    'Props arrive as the first parameter: `function ProfileCard({ name, role })`.',
    'Show them with curly braces: `<h3>{name}</h3>`.',
    'In App: `<ProfileCard name="Mariam" role="Student" />` — then two more with different values.',
  ],
  success: 'That’s the power of props: one component, many cards. The parent (`App`) decides the **data**; the child (`ProfileCard`) decides how it **looks**.',
  challenge: 'Add an `emoji` prop and show it next to the name.',
};

export const ex05: CodeExercise = {
  id: 'ex05',
  n: 5,
  title: 'useState counter',
  minutes: 4,
  level: 5,
  kind: 'code',
  frame: 'web',
  entry: 'App.tsx',
  prompt: 'Make the button work: each click adds 1, and the heading shows `Count: N`. Use **state**.',
  files: {
    'App.tsx': `import { useState } from 'react';

export default function App() {
  let count = 0; // ❌ a normal variable — React doesn't re-render when it changes

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => { count = count + 1; }}>+1</button>
    </div>
  );
}
`,
  },
  checks: [
    {
      id: 'state',
      label: 'the count is stored with `useState`',
      fail: 'Store the number in state: `const [count, setCount] = useState(0);`',
      static: (c) => stateHooks(c.file()).length > 0,
    },
    {
      id: 'setter',
      label: 'the button calls the setter',
      fail: 'The button should call the setter: `onClick={() => setCount(count + 1)}`.',
      static: (c) => {
        const p = c.file();
        const hook = stateHooks(p)[0];
        const click = el(p, 'button').map((b) => b.attrs.onClick).find(Boolean);
        if (!click) return 'Keep the `onClick` on the button.';
        if (!hook?.setter) return false;
        if (containsCall(p, click.node, hook.setter)) return true;
        let assigns = false;
        walk(click.node, (n) => {
          if ((n.type === 'AssignmentExpression' || n.type === 'UpdateExpression') && /count/.test(p.code.slice(n.start, n.end))) assigns = true;
        });
        return assigns ? `You change the variable directly — React won’t notice. Call \`${hook.setter}(…)\` instead.` : false;
      },
    },
    {
      id: 'works',
      label: '3 clicks show `Count: 3`',
      fail: 'After 3 clicks the heading should say `Count: 3`.',
      run: async (c) => {
        for (let i = 0; i < 3; i++) if (!(await c.app.press({ tag: 'button' }))) return 'I couldn’t find a button to click.';
        return /Count:\s*3\b/.test(await c.app.text());
      },
    },
  ],
  hints: [
    'A normal variable starts again at 0 on every render and doesn’t tell React to update. You need **state**.',
    '`const [count, setCount] = useState(0);` gives you the value and a function to change it.',
    'In the button: `onClick={() => setCount(count + 1)}`.',
  ],
  success: '`setCount` saves the new value **and** tells React to render `App` again — that’s why the heading updates. Never change state directly; always use the setter.',
  challenge: 'Add a Reset button that sets the count back to 0.',
};

export const ex06: PredictExercise = {
  id: 'ex06',
  n: 6,
  title: 'When does useEffect run?',
  minutes: 2,
  level: 5,
  kind: 'predict',
  prompt: 'Read each snippet and predict the output. Unsure? Try it in the live demo above.',
  questions: [
    {
      code: `function Clicker() {
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    console.log('effect ran');
  }, []);

  return <button onClick={() => setClicks(clicks + 1)}>{clicks}</button>;
}`,
      question: 'The button is clicked **3 times**. How many times is “effect ran” printed?',
      options: [
        { text: '1 time', correct: true, why: 'An empty array `[]` means “no dependencies”: run once after the first render, never again.' },
        { text: '3 times', why: 'The clicks do re-render, but with `[]` the effect never runs again.' },
        { text: '4 times', why: 'That happens with **no** array at all (after every render: 1 + 3).' },
        { text: '0 times', why: 'An effect always runs at least once — after the first render.' },
      ],
    },
    {
      code: `  useEffect(() => {
    console.log('effect ran');
  }, [clicks]);`,
      question: 'Same component, but the array is now `[clicks]`. After **3 clicks**, how many times is it printed?',
      options: [
        { text: '1 time', why: '`[clicks]` means “run again whenever `clicks` changes” — and it changes 3 times.' },
        { text: '3 times', why: 'Don’t forget the first render: it runs once at the start too.' },
        { text: '4 times', correct: true, why: 'Once after the first render, then once for each of the 3 changes of `clicks`.' },
        { text: '0 times', why: 'Effects always run after the first render.' },
      ],
    },
  ],
  hints: [
    '`useEffect(fn, deps)` runs `fn` after a render; the `deps` array decides when it runs again.',
    '`[]` = never again. `[x]` = again whenever `x` changes.',
    'Count the first render too.',
  ],
  success: 'You’ve got the rule: `useEffect` runs after the first render, then again only when something in its dependency array changes. No array = after every render.',
};
