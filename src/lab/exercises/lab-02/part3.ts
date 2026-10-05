/** Lab 02 · Part 2 (continued) — lists, combining concepts, final challenge. Exercises 14–17. */
import type { CodeExercise, OrderExercise } from '../types.ts';
import type { Parsed } from '../../engine/analyze.ts';
import { containsCall, el, findComponent, jsxElements, jsxShows, stateHooks, walk } from '../helpers.ts';

export const ex14: OrderExercise = {
  id: 'ex14',
  n: 14,
  title: 'Assemble a FlatList screen',
  minutes: 2,
  level: 9,
  kind: 'order',
  mono: true,
  prompt: 'Drag the lines into a working file: an item component, then a screen that lists `COURSES` with it.',
  items: [
    "import { FlatList, Text, View } from 'react-native';",
    'function CourseItem({ title }) {',
    '  return <View className="p-4 border-b border-slate-200"><Text>{title}</Text></View>;',
    '}',
    'export default function App() {',
    '  return <FlatList data={COURSES} keyExtractor={(c) => c.id} renderItem={({ item }) => <CourseItem title={item.title} />} />;',
    '}',
  ],
  hints: [
    'Imports always come first.',
    'Define the item component before the screen that uses it.',
    'Each function’s body sits between its `{` line and its `}` line.',
  ],
  success: 'Imports → item component → the screen that uses it. `renderItem` receives `{ item }` and turns each course into a `<CourseItem />` with props.',
};

export const ex15: CodeExercise = {
  id: 'ex15',
  n: 15,
  title: 'Course list with FlatList',
  minutes: 6,
  level: 9,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Create a `CourseItem` component (props: `title`, `hours`) and render all `COURSES` with a `FlatList`.',
  files: {
    'App.tsx': `import { FlatList, View, Text } from 'react-native';

const COURSES = [
  { id: 'c1', title: 'React basics', hours: 3 },
  { id: 'c2', title: 'React Native UI', hours: 4 },
  { id: 'c3', title: 'Styling with NativeWind', hours: 2 },
  { id: 'c4', title: 'Lists & FlatList', hours: 2 },
  { id: 'c5', title: 'State & hooks', hours: 3 },
];

// 1. Create CourseItem({ title, hours }) — show the title and "{hours} h"

export default function App() {
  return (
    <View className="flex-1 bg-white pt-14">
      <Text className="text-2xl font-bold px-4 mb-2">My courses</Text>
      {/* 2. FlatList: data, keyExtractor and renderItem → <CourseItem … /> */}
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'item',
      label: '`CourseItem` receives `title` and `hours`',
      fail: 'Create `function CourseItem({ title, hours })` that returns a row.',
      static: (c) => {
        const hit = findComponent(c.all, 'CourseItem');
        if (!hit) return false;
        const missing = ['title', 'hours'].filter((k) => !hit.f.props.has(k));
        return missing.length === 0 || `CourseItem doesn’t receive \`${missing.join('` and `')}\` yet.`;
      },
    },
    {
      id: 'itemShows',
      label: 'each row shows the title and hours',
      fail: 'Show both props inside `<Text>`: `{title}` and `{hours} h`.',
      static: (c) => {
        const hit = findComponent(c.all, 'CourseItem');
        return !!hit && jsxShows(hit.f.node, 'title') && jsxShows(hit.f.node, 'hours');
      },
    },
    {
      id: 'flatlist',
      label: '`FlatList` with `data` and `renderItem`',
      fail: 'Add `<FlatList data={COURSES} renderItem={…} />` under the heading.',
      static: (c) => el(c.file(), 'FlatList').some((f) => f.attrs.data && f.attrs.renderItem),
    },
    {
      id: 'render',
      label: '`renderItem` returns a `CourseItem` with props',
      fail: '`renderItem={({ item }) => <CourseItem title={item.title} hours={item.hours} />}`',
      static: (c) => {
        const code = el(c.file(), 'FlatList')[0]?.attrs.renderItem?.code ?? '';
        return /CourseItem/.test(code) && (/title\s*=/.test(code) || /\.\.\.\s*item/.test(code));
      },
    },
    {
      id: 'key',
      label: '`keyExtractor` says which field is unique',
      fail: 'Tell FlatList how to tell rows apart: `keyExtractor={(item) => item.id}`.',
      static: (c) => el(c.file(), 'FlatList').some((f) => !!f.attrs.keyExtractor),
    },
    {
      id: 'rows',
      label: 'all 5 courses are listed',
      fail: 'All 5 courses should appear in the list.',
      run: async (c) => {
        const [list] = await c.app.find({ rn: 'FlatList' });
        if (!list) return 'I can’t see a FlatList on the screen yet.';
        return list.items === 5 || `The list shows ${list.items} row${list.items === 1 ? '' : 's'} — it should be 5.`;
      },
    },
    {
      id: 'hours',
      label: 'rows show text like “React basics · 3 h”',
      fail: 'Each row should show the title and the hours, e.g. “React basics” and “3 h”.',
      run: async (c) => {
        const text = await c.app.text();
        return text.includes('React basics') && /3\s*h\b/.test(text);
      },
    },
  ],
  hints: [
    'The item component is a normal component with props: `function CourseItem({ title, hours }) { return <View>…</View>; }`',
    '`FlatList` needs `data={COURSES}` and `renderItem={({ item }) => …}` — `item` is one course.',
    '`renderItem={({ item }) => <CourseItem title={item.title} hours={item.hours} />}` and `keyExtractor={(item) => item.id}`.',
  ],
  success: 'This is the pattern for every list in React Native: **data** (an array) + an **item component** (props) + **FlatList** to render only what’s on screen.',
  challenge: 'Add `ItemSeparatorComponent={() => <View className="h-px bg-slate-200" />}`.',
};

const CONTACTS_APP = `import { useState } from 'react';
import { View, Text, TextInput, FlatList } from 'react-native';
import ContactCard from './ContactCard';

const CONTACTS = [
  { id: '1', name: 'Mariam Ahmed', phone: '0100 123 4567' },
  { id: '2', name: 'Ali Hassan', phone: '0111 222 3344' },
  { id: '3', name: 'Salma Youssef', phone: '0122 987 6543' },
  { id: '4', name: 'Omar Khaled', phone: '0155 246 8101' },
  { id: '5', name: 'Alia Mostafa', phone: '0109 555 1212' },
];

export default function App() {
  // 1. state: the search text, and the ids of favourite contacts
  // 2. the contacts whose name includes the search text (ignore upper/lower case)

  return (
    <View className="flex-1 bg-slate-50 pt-14 px-4">
      <Text className="text-2xl font-bold mb-3">Contacts</Text>
      <TextInput
        placeholder="Search by name"
        className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-3"
      />
      {/* 3. a FlatList of the filtered contacts → <ContactCard … /> */}
    </View>
  );
}
`;

const CONTACT_CARD = `import { View, Text, Pressable } from 'react-native';

// Props: name, phone, favourite (true / false), onToggle (a function)
export default function ContactCard() {
  return (
    <View className="flex-row items-center bg-white rounded-xl p-4 mb-2">
      <View className="flex-1">
        <Text className="font-semibold">Name</Text>
        <Text className="text-slate-500">Phone</Text>
      </View>
      {/* a Pressable star: ★ when favourite, ☆ when not — pressing it calls onToggle */}
    </View>
  );
}
`;

export const ex16: CodeExercise = {
  id: 'ex16',
  n: 16,
  title: 'Contacts: search & favourites',
  minutes: 10,
  level: 10,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt:
    'Two files. `ContactCard` shows a contact and a ☆/★ star. In `App`, the search box filters the list as you type, and tapping a star marks a favourite.',
  files: { 'App.tsx': CONTACTS_APP, 'ContactCard.tsx': CONTACT_CARD },
  checks: [
    {
      id: 'card',
      label: '`ContactCard` shows the `name` and `phone` props',
      fail: 'In ContactCard.tsx: `function ContactCard({ name, phone, favourite, onToggle })` and show `{name}` / `{phone}`.',
      static: (c) => {
        const hit = findComponent(c.all, 'ContactCard');
        return !!hit && jsxShows(hit.f.node, 'name') && jsxShows(hit.f.node, 'phone');
      },
    },
    {
      id: 'star',
      label: 'the star is a `Pressable` that calls `onToggle`',
      fail: 'Add `<Pressable onPress={onToggle}><Text>{favourite ? \'★\' : \'☆\'}</Text></Pressable>` to the card.',
      static: (c) => c.all.some((p) => el(p, 'Pressable').some((e) => /onToggle/.test(e.attrs.onPress?.code ?? ''))),
    },
    {
      id: 'list',
      label: '`App` renders a `FlatList` of `ContactCard`s',
      fail: 'In App: `<FlatList data={…} renderItem={({ item }) => <ContactCard … />} />`',
      static: (c) => el(c.file('App.tsx'), 'FlatList').some((f) => /ContactCard/.test(f.attrs.renderItem?.code ?? '')),
    },
    {
      id: 'search',
      label: 'typing “ali” leaves only the matching names',
      fail: 'Typing “ali” should leave only Ali Hassan and Alia Mostafa. Filter with `name.toLowerCase().includes(query.toLowerCase())`.',
      run: async (c) => {
        if (!(await c.app.type({}, 'ali'))) return 'I couldn’t find the search TextInput.';
        const text = await c.app.text();
        return text.includes('Ali Hassan') && text.includes('Alia Mostafa') && !text.includes('Omar Khaled') && !text.includes('Mariam Ahmed');
      },
    },
    {
      id: 'favourite',
      label: 'tapping ☆ turns it into ★',
      fail: 'Tapping ☆ should turn that contact’s star into ★ — keep favourite ids in state and pass `favourite={…}` to each card.',
      run: async (c) => {
        const before = (await c.app.text()).split('★').length - 1;
        if (!(await c.app.press({ text: '☆' }))) return 'I couldn’t find a ☆ star to tap.';
        const after = (await c.app.text()).split('★').length - 1;
        return after === before + 1;
      },
    },
  ],
  hints: [
    'Two pieces of state in App: `const [query, setQuery] = useState(\'\')` and `const [favs, setFavs] = useState([])`.',
    'Filter before rendering: `CONTACTS.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))` → give that to `data`.',
    'Toggle: `setFavs(favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id])`; pass `favourite={favs.includes(item.id)}` and `onToggle={() => toggle(item.id)}`.',
  ],
  success: 'You combined everything: state, a derived list (`filter`), `FlatList`, and a reusable card with props — including a **function prop** (`onToggle`) so the child can ask the parent to change state.',
};

/** The tasks state: the useState whose initial value is START or an array. */
function tasksHook(p: Parsed) {
  const hooks = stateHooks(p);
  return hooks.find((h) => /START|^\[/.test(h.initial.trim())) ?? null;
}

/** Function with this name declared anywhere in the file (function x() {} or const x = () => {}). */
function localFunction(p: Parsed, name: string) {
  let found: unknown = null;
  walk(p.ast, (n) => {
    if (found) return;
    if (n.type === 'FunctionDeclaration' && n.id?.name === name) found = n;
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.id.name === name && /Function/.test(n.init?.type ?? '')) found = n.init;
  });
  return found as never;
}

const TASKS_APP = `import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import TaskItem from './TaskItem';

// Build a small task list:
//  • show the tasks with a FlatList, using your TaskItem component
//  • pass each task's title to TaskItem as a prop
//  • a TextInput + an "Add" Pressable that adds a new task
//  • keep the tasks and the input text in state (useState)
//  • style it with NativeWind (className)

const START = [
  { id: '1', title: 'Install Expo Go' },
  { id: '2', title: 'Finish Lab 02' },
];

export default function App() {
  return (
    <View>
      <Text>My tasks</Text>
    </View>
  );
}
`;

const TASK_ITEM = `import { View, Text } from 'react-native';

export default function TaskItem() {
  return (
    <View>
      <Text>Task</Text>
    </View>
  );
}
`;

export const ex17: CodeExercise = {
  id: 'ex17',
  n: 17,
  title: 'Final: task list app',
  minutes: 10,
  level: 10,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Build a small task list from scratch. The checklist below is your spec — it fills in as you meet each requirement.',
  files: { 'App.tsx': TASKS_APP, 'TaskItem.tsx': TASK_ITEM },
  checks: [
    {
      id: 'component',
      label: 'a reusable `TaskItem` component (TaskItem.tsx)',
      fail: 'Keep `export default function TaskItem` in TaskItem.tsx and make it return a row.',
      static: (c) => {
        const p = c.file('TaskItem.tsx');
        const f = findComponent([p], 'TaskItem');
        return !!f && f.f.exportedDefault && f.f.returnsJsx;
      },
    },
    {
      id: 'props',
      label: 'task info is passed to `TaskItem` as a prop',
      fail: 'Give TaskItem a prop and show it: `function TaskItem({ title }) { … <Text>{title}</Text> … }`.',
      static: (c) => {
        const hit = findComponent([c.file('TaskItem.tsx')], 'TaskItem');
        if (!hit || hit.f.props.size === 0) return false;
        return [...hit.f.props].some((name) => jsxShows(hit.f.node, name));
      },
    },
    {
      id: 'state',
      label: 'the tasks are kept with `useState`',
      fail: 'Keep the list in state: `const [tasks, setTasks] = useState(START);`',
      static: (c) => !!tasksHook(c.file()),
    },
    {
      id: 'input',
      label: 'a `TextInput` with `value` and `onChangeText`',
      fail: 'Add a controlled input: `<TextInput value={text} onChangeText={setText} placeholder="New task" />`.',
      static: (c) => el(c.file(), 'TextInput').some((e) => e.attrs.value && e.attrs.onChangeText),
    },
    {
      id: 'add',
      label: 'an “Add” `Pressable` that adds a task',
      fail: 'The Add button’s onPress must create a NEW array: `setTasks([...tasks, { id: String(Date.now()), title: text }])`.',
      static: (c) => {
        const p = c.file();
        const hook = tasksHook(p);
        if (!hook?.setter) return false;
        return el(p, 'Pressable').some((b) => {
          const onPress = b.attrs.onPress;
          if (!onPress) return false;
          if (containsCall(p, onPress.node, hook.setter)) return true;
          const fn = localFunction(p, onPress.code.trim());
          return !!fn && containsCall(p, fn, hook.setter);
        });
      },
    },
    {
      id: 'flatlist',
      label: 'a `FlatList` renders `TaskItem`s from the state',
      fail: '`<FlatList data={tasks} keyExtractor={(t) => t.id} renderItem={({ item }) => <TaskItem title={item.title} />} />`',
      static: (c) => {
        const p = c.file();
        const hook = tasksHook(p);
        return el(p, 'FlatList').some((f) => /TaskItem/.test(f.attrs.renderItem?.code ?? '') && (!hook || (f.attrs.data?.code ?? '').includes(hook.state)));
      },
    },
    {
      id: 'nativewind',
      label: 'styled with NativeWind (`className`)',
      fail: 'Style at least 3 elements with `className`, e.g. `className="flex-1 bg-white pt-14 px-4"`.',
      static: (c) => c.all.reduce((n, p) => n + jsxElements(p).filter((e) => e.attrs.className?.value?.trim()).length, 0) >= 3,
    },
    {
      id: 'shows',
      label: 'the starting tasks are shown',
      fail: 'Both starting tasks (“Install Expo Go”, “Finish Lab 02”) should be visible.',
      run: async (c) => {
        const text = await c.app.text();
        return text.includes('Install Expo Go') && text.includes('Finish Lab 02');
      },
    },
    {
      id: 'adds',
      label: 'typing a task and pressing Add shows it',
      fail: 'Type “Buy milk”, press Add → “Buy milk” should appear in the list.',
      run: async (c) => {
        if (!(await c.app.type({}, 'Buy milk'))) return 'I couldn’t find the TextInput.';
        if (!(await c.app.press({ text: 'Add' }))) return 'I couldn’t find an Add button.';
        const [list] = await c.app.find({ rn: 'FlatList' });
        return (await c.app.text()).includes('Buy milk') && (!list || list.items === 3);
      },
    },
  ],
  hints: [
    'Start with TaskItem.tsx: `function TaskItem({ title })` that shows `{title}` inside a `<Text>`.',
    'In App: `const [tasks, setTasks] = useState(START)`, `const [text, setText] = useState(\'\')`, then a FlatList with `renderItem={({ item }) => <TaskItem title={item.title} />}`.',
    'Adding = a NEW array: `setTasks([...tasks, { id: String(Date.now()), title: text }])`, then `setText(\'\')`.',
  ],
  success:
    '🎉 You built a real React Native feature from scratch: a reusable component with props, state, a controlled TextInput, a Pressable that updates state, a FlatList and NativeWind styling. That’s the core of every app in this course.',
  challenge: 'Tap a task to mark it done (`line-through`), or add a Delete button.',
};
