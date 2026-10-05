import type { Playground } from '@/lib/playgrounds';

const start = `import { useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export default function App() {
  // TODO 1: const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.screen}>
      {/* TODO 2: attach the ref: ref={inputRef} */}
      <TextInput style={styles.input} placeholder="Email" />

      {/* TODO 3: on press, focus the input: inputRef.current?.focus() */}
      <Pressable style={styles.btn} onPress={() => {}}>
        <Text style={styles.btnText}>Focus the input</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16 },
  btn: { backgroundColor: '#111', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
`;

const solution = `import { useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.screen}>
      <TextInput ref={inputRef} style={styles.input} placeholder="Email" />
      <Pressable style={styles.btn} onPress={() => inputRef.current?.focus()}>
        <Text style={styles.btnText}>Focus the input</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16 },
  btn: { backgroundColor: '#111', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
`;

export default {
  title: 'Focus with useRef',
  goal: 'Make the button **put the cursor in the Email box**. You need to reach the real input, which is what `useRef` is for.',
  hint: 'A ref is a box that points at the component: `const inputRef = useRef<TextInput>(null)`, `<TextInput ref={inputRef} />`, then `inputRef.current?.focus()`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Creates a ref with useRef', steps: [{ expectCode: 'useRef\\s*(<[^>]*>)?\\s*\\(', message: 'Create the ref: const inputRef = useRef<TextInput>(null);' }] },
    { name: 'The button focuses the input', steps: [{ press: 'Focus the input' }, { expectFocused: 'Email' }] },
  ],
} satisfies Playground;
