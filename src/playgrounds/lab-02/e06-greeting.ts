import type { Playground } from '@/lib/playgrounds';

const styles = `const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#F0FDFA' },
  card: { gap: 14, padding: 22, borderRadius: 26, backgroundColor: '#FFFFFF', boxShadow: '0 14px 36px rgba(13, 148, 136, 0.14)' },
  wave: { fontSize: 40 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: '#14B8A6' },
  input: { borderWidth: 1.5, borderColor: '#99F6E4', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#F8FFFE' },
  hello: { fontSize: 28, fontWeight: '800', color: '#134E4A' },
  count: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: '#CCFBF1', color: '#0F766E', fontWeight: '700', fontSize: 12 },
});
`;

const start = `import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function App() {
  // TODO 1: a state variable for the name: const [name, setName] = useState('');

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.wave}>👋</Text>
        <Text style={styles.label}>WHAT'S YOUR NAME?</Text>
        {/* TODO 2: connect the input: value={name} onChangeText={setName} */}
        <TextInput style={styles.input} placeholder="Your name" />

        {/* TODO 3: "Hello, <name>" (or "Hello, stranger" while it is empty) */}
        <Text style={styles.hello}>Hello, stranger</Text>

        {/* TODO 4: "<number> characters" using name.length */}
        <Text style={styles.count}>0 characters</Text>
      </View>
    </View>
  );
}

${styles}`;

const solution = `import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function App() {
  const [name, setName] = useState('');

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.wave}>👋</Text>
        <Text style={styles.label}>WHAT'S YOUR NAME?</Text>
        <TextInput style={styles.input} placeholder="Your name" value={name} onChangeText={setName} />
        <Text style={styles.hello}>Hello, {name || 'stranger'}</Text>
        <Text style={styles.count}>{name.length} characters</Text>
      </View>
    </View>
  );
}

${styles}`;

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
