import type { Playground } from '@/lib/playgrounds';

const start = `import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function App() {
  // TODO 1: a state variable for the name: const [name, setName] = useState('');

  return (
    <View style={styles.screen}>
      {/* TODO 2: connect the input: value={name} onChangeText={setName} */}
      <TextInput style={styles.input} placeholder="Your name" />

      {/* TODO 3: "Hello, <name>" (or "Hello, stranger" while it is empty) */}
      <Text style={styles.hello}>Hello, stranger</Text>

      {/* TODO 4: "<number> characters" using name.length */}
      <Text style={styles.count}>0 characters</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16 },
  hello: { fontSize: 26, fontWeight: '700' },
  count: { color: '#64748b' },
});
`;

const solution = `import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function App() {
  const [name, setName] = useState('');

  return (
    <View style={styles.screen}>
      <TextInput style={styles.input} placeholder="Your name" value={name} onChangeText={setName} />
      <Text style={styles.hello}>Hello, {name || 'stranger'}</Text>
      <Text style={styles.count}>{name.length} characters</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16 },
  hello: { fontSize: 26, fontWeight: '700' },
  count: { color: '#64748b' },
});
`;

export default {
  title: 'Live greeting',
  goal: 'Store what the user types in **state** and show it live: **Hello, Sara** and **4 characters**.',
  hint: '`const [name, setName] = useState(\'\')`, then `<TextInput value={name} onChangeText={setName} />`. Fallback text: `{name || \'stranger\'}`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Empty input shows "Hello, stranger"', steps: [{ expectText: 'Hello, stranger', exact: true }] },
    { name: 'Typing "Sara" shows "Hello, Sara"', steps: [{ type: 'Sara', into: 'Your name' }, { expectText: 'Hello, Sara', exact: true }] },
    { name: 'Counts the characters', steps: [{ type: 'Sara', into: 'Your name' }, { expectText: '4 characters', exact: true }] },
    { name: 'Clearing goes back to "stranger"', steps: [{ type: 'Sara', into: 'Your name' }, { type: '', into: 'Your name' }, { expectText: 'Hello, stranger', exact: true }] },
  ],
} satisfies Playground;
