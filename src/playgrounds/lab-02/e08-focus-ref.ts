import type { Playground } from '@/lib/playgrounds';

const styles = `const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#FFF7ED' },
  card: { gap: 12, padding: 22, borderRadius: 26, backgroundColor: '#FFFFFF', boxShadow: '0 14px 36px rgba(194, 65, 12, 0.14)' },
  logo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFEDD5' },
  logoText: { fontSize: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#431407' },
  sub: { color: '#9A3412', marginTop: -6 },
  label: { fontSize: 13, fontWeight: '700', color: '#7C2D12', marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: '#FED7AA', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#FFFBF7' },
  btn: { marginTop: 6, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#EA580C', boxShadow: '0 8px 18px rgba(234, 88, 12, 0.3)' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
`;

const start = `import { useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export default function App() {
  // TODO 1: const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.logo}><Text style={styles.logoText}>📬</Text></View>
        <Text style={styles.title}>Join the newsletter</Text>
        <Text style={styles.sub}>One email a week. No spam.</Text>
        <Text style={styles.label}>Email</Text>
        {/* TODO 2: attach the ref: ref={inputRef} */}
        <TextInput style={styles.input} placeholder="Email" />

        {/* TODO 3: on press, focus the input: inputRef.current?.focus() */}
        <Pressable style={styles.btn} onPress={() => {}}>
          <Text style={styles.btnText}>Focus the input</Text>
        </Pressable>
      </View>
    </View>
  );
}

${styles}`;

const solution = `import { useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.logo}><Text style={styles.logoText}>📬</Text></View>
        <Text style={styles.title}>Join the newsletter</Text>
        <Text style={styles.sub}>One email a week. No spam.</Text>
        <Text style={styles.label}>Email</Text>
        <TextInput ref={inputRef} style={styles.input} placeholder="Email" />
        <Pressable style={styles.btn} onPress={() => inputRef.current?.focus()}>
          <Text style={styles.btnText}>Focus the input</Text>
        </Pressable>
      </View>
    </View>
  );
}

${styles}`;

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
