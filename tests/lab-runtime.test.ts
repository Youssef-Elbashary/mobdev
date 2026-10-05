// The lab preview runtime (React + react-native-web + our react-native shim) rendered in happy-dom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { compileAll } = await import('../src/lab/engine/compile.ts');

type Msg = { type: string; error?: { message: string; hint?: string; file?: string; line?: number } };

function harness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const messages: Msg[] = [];
  const runtime = createRuntime({ container, post: (m) => messages.push(m as Msg) });
  let id = 0;
  async function run(files: Record<string, string>, entry = 'App.tsx', frame: 'phone' | 'web' = 'phone') {
    const compiled = compileAll(files);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.errors));
    messages.length = 0;
    await runtime.run({ type: 'run', id: ++id, files: compiled.files, entry, frame });
    return { rendered: messages.some((m) => m.type === 'rendered'), error: messages.find((m) => m.type === 'error')?.error };
  }
  return { runtime, run, d: runtime.driver, container };
}

test('renders React Native components with data-rn tags', async () => {
  const { run, d } = harness();
  const r = await run({
    'App.tsx': `import { View, Text } from 'react-native';
export default function App() {
  return <View><Text>Hello, Mobile Dev</Text></View>;
}`,
  });
  assert.equal(r.rendered, true);
  assert.match(await d.text(), /Hello, Mobile Dev/);
  assert.equal(await d.count({ rn: 'Text' }), 1);
  assert.equal(await d.count({ rn: 'View' }), 1);
});

test('useState + Pressable: pressing updates the screen', async () => {
  const { run, d } = harness();
  await run({
    'App.tsx': `import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
export default function App() {
  const [count, setCount] = useState(0);
  return (
    <View>
      <Text>Count: {count}</Text>
      <Pressable onPress={() => setCount(count + 1)}><Text>+1</Text></Pressable>
    </View>
  );
}`,
  });
  assert.match(await d.text(), /Count: 0/);
  assert.equal(await d.press({ text: '+1' }), true);
  await d.press({ text: '+1' });
  assert.match(await d.text(), /Count: 2/);
});

test('TextInput: typing calls onChangeText', async () => {
  const { run, d } = harness();
  await run({
    'App.tsx': `import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
export default function App() {
  const [name, setName] = useState('');
  return (
    <View>
      <TextInput placeholder="Your name" value={name} onChangeText={setName} />
      <Text>Hello, {name}!</Text>
    </View>
  );
}`,
  });
  assert.equal(await d.type({ placeholder: 'name' }, 'Sara'), true);
  assert.match(await d.text(), /Hello, Sara!/);
  const [input] = await d.find({ rn: 'TextInput' });
  assert.equal(input.value, 'Sara');
});

test('raw text inside <View> fails like real React Native, pointing at the line', async () => {
  const { run } = harness();
  const r = await run({
    'App.tsx': `import { View } from 'react-native';
export default function App() {
  return <View>Hello</View>;
}`,
  });
  assert.equal(r.rendered, false);
  assert.match(r.error!.message, /Text strings must be rendered within a <Text> component/);
  assert.match(r.error!.hint!, /Wrap the words in <Text>/);
});

test('className works like NativeWind and the resolved style is readable', async () => {
  const { run, d } = harness();
  await run({
    'App.tsx': `import { View, Text } from 'react-native';
export default function App() {
  return <View className="flex-1 p-4 bg-blue-500" style={{ borderRadius: 12 }}><Text className="text-white text-2xl font-bold">Hi</Text></View>;
}`,
  });
  const [view] = await d.find({ rn: 'View' });
  assert.equal(view.style.padding, 16);
  assert.equal(view.style.backgroundColor, '#3b82f6');
  assert.equal(view.style.borderRadius, 12);
  assert.equal(view.className, 'flex-1 p-4 bg-blue-500');
  const [text] = await d.find({ rn: 'Text' });
  assert.deepEqual([text.style.color, text.style.fontSize, text.style.fontWeight], ['#ffffff', 24, '700']);
});

test('FlatList renders one row per item', async () => {
  const { run, d } = harness();
  await run({
    'App.tsx': `import { FlatList, Text } from 'react-native';
const COURSES = [{ id: '1', title: 'React' }, { id: '2', title: 'React Native' }, { id: '3', title: 'Expo' }];
export default function App() {
  return <FlatList data={COURSES} keyExtractor={(c) => c.id} renderItem={({ item }) => <Text>{item.title}</Text>} />;
}`,
  });
  const [list] = await d.find({ rn: 'FlatList' });
  assert.ok(list, 'FlatList is tagged');
  assert.equal(list.items, 3);
  assert.match(await d.text(), /React React Native Expo/);
});

test('SafeAreaView adds the phone status-bar inset', async () => {
  const { run, container } = harness();
  await run({
    'App.tsx': `import { SafeAreaView, Text } from 'react-native';
export default function App() { return <SafeAreaView><Text>Safe</Text></SafeAreaView>; }`,
  });
  const el = container.querySelector('[data-rn="SafeAreaView"]') as HTMLElement;
  assert.ok(el);
  assert.equal(getComputedStyle(el).paddingTop, '44px');
});

test('a missing Text/Image import is not confused with the browser’s DOM classes', async () => {
  const { run } = harness();
  const r = await run({
    'App.tsx': `import { View } from 'react-native';
export default function App() {
  return <View><Text>Hi</Text></View>;
}`,
  });
  assert.match(r.error!.message, /Text is not defined/);
  assert.match(r.error!.hint!, /import \{ Text \} from 'react-native'/);
});

test('an undeclared variable points at the student’s line', async () => {
  const { run } = harness();
  const r = await run({
    'App.tsx': `import { View, Text } from 'react-native';
export default function App() {
  return <View><Text>{titel}</Text></View>;
}`,
  });
  assert.match(r.error!.message, /titel is not defined/);
  assert.equal(r.error!.file, 'App.tsx');
  assert.equal(r.error!.line, 3);
});

test('two files: a component imported from ./components', async () => {
  const { run, d } = harness();
  const r = await run({
    'App.tsx': `import { View } from 'react-native';
import ProfileCard from './components/ProfileCard';
export default function App() {
  return <View><ProfileCard name="Mariam" role="Student" /><ProfileCard name="Ali" role="TA" /></View>;
}`,
    'components/ProfileCard.tsx': `import { Text } from 'react-native';
export default function ProfileCard({ name, role }) { return <Text>{name} · {role}</Text>; }`,
  });
  assert.equal(r.rendered, true);
  assert.match(await d.text(), /Mariam · Student Ali · TA/);
});

test('web frame (React part): <div> and <button onClick>', async () => {
  const { run, d } = harness();
  await run(
    {
      'App.tsx': `import { useState } from 'react';
export default function App() {
  const [likes, setLikes] = useState(0);
  return <div><h1>Likes: {likes}</h1><button onClick={() => setLikes(likes + 1)}>Like</button></div>;
}`,
    },
    'App.tsx',
    'web',
  );
  await d.press({ text: 'Like' });
  assert.match(await d.text(), /Likes: 1/);
  assert.equal(await d.count({ tag: 'h1' }), 1);
});

test('expo-router: app/_layout.tsx shows app/index.tsx', async () => {
  const { run, d } = harness();
  const r = await run(
    {
      'app/_layout.tsx': `import { Stack } from 'expo-router';
export default function RootLayout() { return <Stack />; }`,
      'app/index.tsx': `import { Text, View } from 'react-native';
export default function Index() { return <View><Text>First screen</Text></View>; }`,
    },
    'app/_layout.tsx',
  );
  assert.equal(r.rendered, true);
  assert.match(await d.text(), /First screen/);
});

test('react-dom/client createRoot in main.tsx renders <App />', async () => {
  const { run, d } = harness();
  const r = await run(
    {
      'main.tsx': `import { createRoot } from 'react-dom/client';
import App from './App';
createRoot(document.getElementById('root')).render(<App />);`,
      'App.tsx': `export default function App() { return <h1>Hello from App</h1>; }`,
    },
    'main.tsx',
    'web',
  );
  assert.equal(r.rendered, true);
  assert.match(await d.text(), /Hello from App/);
});

test('unknown package gives a clear message', async () => {
  const { run } = harness();
  const r = await run({ 'App.tsx': `import axios from 'axios';\nexport default function App() { axios.get('/x'); return null; }` });
  assert.match(r.error!.message, /The package 'axios' isn't available/);
});
